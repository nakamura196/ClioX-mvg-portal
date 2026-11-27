/**
 * Cloudflare Worker for cliox.ldas.jp (static Next.js export + lightweight APIs).
 *
 * Static pages and /_next/static/* are served directly by Workers Assets
 * (0 ms Worker CPU). This Worker handles only:
 *   - /api/auth/ldas/*   (id.ldas.jp OID4VP 1.0 + dc+sd-jwt + kb+jwt sign-in)
 *   - /api/policy-server (Ocean Node POLICY_SERVER_URL verifier for id.ldas.jp VCs)
 *   - /api/provider-application/* (verified-provider applications, [prototype])
 *   - /api/chatbot/*     (proxy to mdx chatbot service)
 *   - /api/contact*      (Resend / CF7 contact form)
 *   - /robots.txt, /sitemap.xml, legacy redirects
 *   - SPA-style rewrites for /ja/*, /asset/*, /profile/*, /experiment/finding-aid/*
 */

// [local patch] green reward checker
import { handleQuoteBody } from './greenReward'
import type { RealEnvEntry } from '../src/experiment/footprint/lib/realEnvsCore'
import realEnvs from '../content/experiment/real-envs.json'
import {
  verifyLdasCredential,
  bytesToB64url,
  type VerifiedLdasUser
} from './ldasVerify.ts'
import {
  allowApplication,
  buildEntry,
  composeEmailBody,
  signApplication,
  toChecksumAddress
} from './providerApplication.ts'
import {
  ApplicationError,
  assertLive,
  assertReady,
  consumeNonce,
  messageFor,
  newApplyState,
  withSignature,
  type ApplyState
} from './applicationFlow.ts'

export interface Env {
  ASSETS: { fetch: (req: Request | URL | string) => Promise<Response> }
  LDAS_ID_ORIGIN?: string
  SESSION_SECRET?: string
  CHATBOT_API_URL?: string
  CHATBOT_API_KEY?: string
  CHATBOT_REQUIRE_SIGNIN?: string
  CHATBOT_SIGNIN_SECRET?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  CONTACT_EMAIL?: string
  POLICY_REQUIRE_MEMBER?: string
  /** Where applications are sent (secret/var; never hardcoded) */
  OPERATOR_EMAIL?: string
  /** HMAC key that signs each application email */
  APPLICATION_SIGNING_KEY?: string
  // [local patch] green reward checker (2026-11-27): signing-only key, no funds
  GREEN_REWARD_CHECKER_KEY?: string
  GREEN_REWARD_CONTRACT?: string
}

const LDAS_SESSION_COOKIE = 'cliox_ldas_session'
const LDAS_AUTH_STATE_COOKIE = 'cliox_ldas_state'
const SESSION_TTL_SEC = 24 * 60 * 60
const STATE_TTL_SEC = 10 * 60
const APPLY_STATE_COOKIE = 'cliox_ldas_apply'

const LEGACY_REDIRECTS: Record<string, { to: string; status: number }> = {
  '/publish': { to: '/publish/1/', status: 308 },
  '/publish/': { to: '/publish/1/', status: 308 },
  '/signup': { to: '/coming-soon/', status: 307 },
  '/documentation': { to: '/coming-soon/', status: 307 },
  '/docs': { to: '/coming-soon/', status: 307 },
  '/newsletter': { to: '/coming-soon/', status: 307 }
}

// [prototype] Prototype pages moved under /experiment/<name> (2026-11-25).
// Same rules as the redirects in next.config.js, which a static export ignores.
const MOVED_PROTOTYPES = [
  'carbon-choice',
  'carbon-report',
  'archivist-qa',
  'sample-collection',
  'glossary'
]

// [prototype] Fig. 1 moved from /experiment/paper-fig to a real asset page
// with ?demo=1 (2026-11-25); same rule as in next.config.js.
const FIG1_ASSET =
  '/asset/did:op:04f79245ba012ab323600b60bb537c865560ca18867025a3d31b38f4560b9787/'

function prototypeRedirect(url: URL): string | null {
  const ja = url.pathname === '/ja' || url.pathname.startsWith('/ja/')
  const prefix = ja ? '/ja' : ''
  const p = (ja ? url.pathname.slice(3) : url.pathname).replace(/\/+$/, '')
  const name = p.slice(1)
  if (name === 'paper-fig' || name === 'experiment/paper-fig') {
    const q = new URLSearchParams(url.search)
    q.set('demo', '1')
    return `${prefix}${FIG1_ASSET}?${q.toString()}`
  }
  if (MOVED_PROTOTYPES.includes(name)) {
    return `${prefix}/experiment/${name}/${url.search}`
  }
  if (
    p === '/experiment' &&
    ['view', 'condition', 'sample'].some((k) => url.searchParams.has(k))
  ) {
    return `${prefix}/experiment/two-condition/${url.search}`
  }
  const fa = /^\/asset\/([^/]+)\/finding-aid$/.exec(p)
  if (fa) return `${prefix}/experiment/finding-aid/${fa[1]}/${url.search}`
  return null
}

const ROBOTS_TXT = `# ClioX Privacy-Focused Robots.txt
User-agent: *
Sitemap: https://cliox.ldas.jp/sitemap.xml
Allow: /
Allow: /resources
Allow: /articles
Allow: /privacy/en
Allow: /terms
Allow: /imprint
Disallow: /api/
Disallow: /_next/
Disallow: /admin/
Disallow: /profile/
Disallow: /asset/
Disallow: /search
Disallow: /bookmarks
Disallow: /onboarding/
Disallow: /usecases
Disallow: /verify
Disallow: /faucet
Disallow: /publish/
Disallow: /ldas-callback

User-agent: GPTBot
Disallow: /
User-agent: ChatGPT-User
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: anthropic-ai
Disallow: /
User-agent: Claude-Web
Disallow: /
`

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  })
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get('Cookie') || ''
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

function makeCookie(
  name: string,
  value: string,
  maxAgeSec: number,
  isHttps: boolean,
  path = '/'
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ]
  if (isHttps) parts.push('Secure')
  return parts.join('; ')
}

function sessionSecret(env: Env, url: URL): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET
  if (env.CHATBOT_SIGNIN_SECRET) return env.CHATBOT_SIGNIN_SECRET
  if (env.CHATBOT_API_KEY) return env.CHATBOT_API_KEY
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return 'cliox-local-dev-session-secret'
  }
  throw new Error('SESSION_SECRET is not configured')
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  )
  return bytesToB64url(new Uint8Array(sig))
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function sealPayload(secret: string, payload: unknown): Promise<string> {
  const encoded = bytesToB64url(
    new TextEncoder().encode(JSON.stringify(payload))
  )
  const sig = await hmacSign(secret, encoded)
  return `${encoded}.${sig}`
}

async function unsealPayload<T>(
  secret: string,
  token: string | undefined
): Promise<T | null> {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const encoded = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await hmacSign(secret, encoded)
  if (!timingSafeEqualStr(sig, expected)) return null
  try {
    const pad = (4 - (encoded.length % 4)) % 4
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

async function getLdasSession(
  req: Request,
  env: Env,
  url: URL
): Promise<VerifiedLdasUser | null> {
  const cookies = parseCookies(req)
  let secret: string
  try {
    secret = sessionSecret(env, url)
  } catch {
    return null
  }
  const session = await unsealPayload<{
    user: VerifiedLdasUser
    exp: number
  }>(secret, cookies[LDAS_SESSION_COOKIE])
  if (!session || session.exp < Math.floor(Date.now() / 1000)) return null
  return session.user
}

// ---------------------------------------------------------------------------
// 1. id.ldas.jp OID4VP 1.0 + dc+sd-jwt + kb+jwt authentication endpoints
// ---------------------------------------------------------------------------

async function handleLdasStart(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const issuerOrigin = (env.LDAS_ID_ORIGIN || 'https://id.ldas.jp').replace(
    /\/+$/,
    ''
  )
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  const redirectUri = `${url.origin}/ldas-callback/`
  const dcqlQuery = JSON.stringify({
    credentials: [
      {
        id: 'cliox-ldas-member',
        format: 'dc+sd-jwt',
        meta: { vct_values: [`${issuerOrigin}/credentials/member/v1`] },
        claims: [
          { path: ['credentialSubject', 'name'] },
          { path: ['credentialSubject', 'orcid'] },
          { path: ['credentialSubject', 'memberOf'] },
          { path: ['credentialSubject', 'affiliation'] },
          { path: ['credentialSubject', 'emailDomain'] },
          { path: ['credentialSubject', 'wallet'] }
        ]
      }
    ]
  })

  const authUrl = new URL(`${issuerOrigin}/authorize`)
  authUrl.search = new URLSearchParams({
    response_type: 'vp_token',
    client_id: url.origin,
    redirect_uri: redirectUri,
    nonce,
    state,
    dcql_query: dcqlQuery
  }).toString()

  const sealed = await sealPayload(sessionSecret(env, url), {
    state,
    nonce,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SEC
  })
  const setCookie = makeCookie(
    LDAS_AUTH_STATE_COOKIE,
    sealed,
    STATE_TTL_SEC,
    url.protocol === 'https:'
  )

  if (url.searchParams.get('mode') === 'json') {
    return json({ authorizeUrl: authUrl.toString(), state }, 200, {
      'Set-Cookie': setCookie
    })
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': setCookie,
      'Cache-Control': 'no-store'
    }
  })
}

async function handleLdasVerify(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as {
    vp_token?: string
    vc?: string
    state?: string
  }
  const rawToken = body.vp_token || body.vc
  if (!rawToken || typeof rawToken !== 'string') {
    return json({ error: 'vp_token is required' }, 400)
  }

  const secret = sessionSecret(env, url)
  const cookies = parseCookies(req)
  const saved = await unsealPayload<{
    state: string
    nonce: string
    exp: number
  }>(secret, cookies[LDAS_AUTH_STATE_COOKIE])

  if (!saved || saved.exp < Math.floor(Date.now() / 1000)) {
    return json({ error: 'Login session expired; please try again' }, 400)
  }
  if (!body.state || !timingSafeEqualStr(body.state, saved.state)) {
    return json({ error: 'OAuth/OID4VP state mismatch' }, 400)
  }

  const issuerOrigin = (env.LDAS_ID_ORIGIN || 'https://id.ldas.jp').replace(
    /\/+$/,
    ''
  )
  try {
    const { verification: _evidence, ...user } = await verifyLdasCredential(
      rawToken,
      {
        issuerOrigin,
        expectedAud: url.origin,
        expectedNonce: saved.nonce,
        requireKeyBinding: Boolean(body.vp_token)
      }
    )

    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC
    const sealedSession = await sealPayload(secret, { user, exp })
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    headers.append(
      'Set-Cookie',
      makeCookie(
        LDAS_SESSION_COOKIE,
        sealedSession,
        SESSION_TTL_SEC,
        url.protocol === 'https:'
      )
    )
    headers.append(
      'Set-Cookie',
      makeCookie(LDAS_AUTH_STATE_COOKIE, '', 0, url.protocol === 'https:')
    )
    return new Response(JSON.stringify({ authenticated: true, user }), {
      status: 200,
      headers
    })
  } catch (err) {
    return json(
      {
        error:
          err instanceof Error ? err.message : 'Credential verification failed'
      },
      401
    )
  }
}

async function handleLdasMe(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const user = await getLdasSession(req, env, url)
  return json({
    authenticated: Boolean(user),
    user,
    issuerOrigin: (env.LDAS_ID_ORIGIN || 'https://id.ldas.jp').replace(
      /\/+$/,
      ''
    )
  })
}

async function handleLdasLogout(url: URL): Promise<Response> {
  return json({ authenticated: false, user: null }, 200, {
    'Set-Cookie': makeCookie(
      LDAS_SESSION_COOKIE,
      '',
      0,
      url.protocol === 'https:'
    )
  })
}

// ---------------------------------------------------------------------------
// 1b. Verified-provider application (plan B: wallet signature + id.ldas.jp
//     credential, both bound to one nonce; see worker/applicationFlow.ts)
// ---------------------------------------------------------------------------

function issuerOriginOf(env: Env): string {
  return (env.LDAS_ID_ORIGIN || 'https://id.ldas.jp').replace(/\/+$/, '')
}

function isLocalHost(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

async function readApplyState(
  req: Request,
  env: Env,
  url: URL
): Promise<ApplyState | null> {
  return unsealPayload<ApplyState>(
    sessionSecret(env, url),
    parseCookies(req)[APPLY_STATE_COOKIE]
  )
}

async function applyStateHeaders(
  env: Env,
  url: URL,
  state: ApplyState
): Promise<Record<string, string>> {
  const maxAge = Math.max(0, state.exp - Math.floor(Date.now() / 1000))
  return {
    'Set-Cookie': makeCookie(
      APPLY_STATE_COOKIE,
      await sealPayload(sessionSecret(env, url), state),
      maxAge,
      url.protocol === 'https:'
    )
  }
}

function clearApplyHeaders(url: URL): Record<string, string> {
  return {
    'Set-Cookie': makeCookie(
      APPLY_STATE_COOKIE,
      '',
      0,
      url.protocol === 'https:'
    )
  }
}

function applyStatus(state: ApplyState): Record<string, unknown> {
  return {
    active: true,
    address: state.address,
    message: messageFor(state),
    signer: state.signer || null,
    credential: state.credential
      ? {
          name: state.credential.entry.name,
          method: state.credential.entry.method,
          selfDeclaredName: state.credential.entry.selfDeclaredName
        }
      : null,
    expiresAt: new Date(state.exp * 1000).toISOString()
  }
}

/** Stage 1. POST {wallet, consent}: new nonce and the message to sign. */
async function handleApplyStart(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string
    consent?: boolean
  }
  if (!body.wallet || !/^0x[0-9a-fA-F]{40}$/.test(body.wallet)) {
    return json({ error: 'Connect your wallet first' }, 400)
  }
  if (body.consent !== true) {
    return json({ error: 'Consent is required' }, 400)
  }
  const state = newApplyState(toChecksumAddress(body.wallet), url.origin)
  return json(
    { nonce: state.nonce, message: messageFor(state) },
    200,
    await applyStateHeaders(env, url, state)
  )
}

/** Stage 2. POST {signature}: recover the signer of the message from stage 1. */
async function handleApplySignature(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { signature?: string }
  const state = withSignature(
    assertLive(await readApplyState(req, env, url)),
    String(body.signature || '')
  )
  return json(applyStatus(state), 200, await applyStateHeaders(env, url, state))
}

/** Stage 3a. POST: id.ldas.jp authorize URL whose nonce is the application nonce. */
async function handleApplyPresent(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const state = assertLive(await readApplyState(req, env, url))
  if (!state.signer) {
    throw new ApplicationError('Sign the application with your wallet first')
  }
  const issuerOrigin = issuerOriginOf(env)
  const oid4vpState = crypto.randomUUID()
  // No wallet claim is requested: the wallet is proven by the signature.
  const dcqlQuery = JSON.stringify({
    credentials: [
      {
        id: 'cliox-ldas-member',
        format: 'dc+sd-jwt',
        meta: { vct_values: [`${issuerOrigin}/credentials/member/v1`] },
        claims: [
          { path: ['credentialSubject', 'name'] },
          { path: ['credentialSubject', 'orcid'] },
          { path: ['credentialSubject', 'affiliation'] },
          { path: ['credentialSubject', 'emailDomain'] }
        ]
      }
    ]
  })
  const authUrl = new URL(`${issuerOrigin}/authorize`)
  authUrl.search = new URLSearchParams({
    response_type: 'vp_token',
    client_id: url.origin,
    redirect_uri: `${url.origin}/ldas-callback/`,
    nonce: state.nonce,
    state: oid4vpState,
    dcql_query: dcqlQuery
  }).toString()
  const next: ApplyState = { ...state, oid4vpState, credential: undefined }
  return json(
    { authorizeUrl: authUrl.toString() },
    200,
    await applyStateHeaders(env, url, next)
  )
}

/** Stage 3b. POST {vp_token, state}: verify the credential, keep only the entry. */
async function handleApplyCredential(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    vp_token?: string
    state?: string
  }
  if (!body.vp_token || typeof body.vp_token !== 'string') {
    return json({ error: 'vp_token is required' }, 400)
  }
  const state = assertLive(await readApplyState(req, env, url))
  if (
    !state.oid4vpState ||
    !body.state ||
    !timingSafeEqualStr(body.state, state.oid4vpState)
  ) {
    return json({ error: 'OID4VP state mismatch' }, 400)
  }
  let user: VerifiedLdasUser
  try {
    user = await verifyLdasCredential(body.vp_token, {
      issuerOrigin: issuerOriginOf(env),
      expectedAud: url.origin,
      expectedNonce: state.nonce,
      requireKeyBinding: true
    })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      401
    )
  }
  // The credential may still carry a wallet (did:pkh); it is ignored here.
  const next: ApplyState = {
    ...state,
    oid4vpState: undefined,
    credential: {
      nonce: state.nonce,
      entry: buildEntry(user, user.verification)
    }
  }
  return json(applyStatus(next), 200, await applyStateHeaders(env, url, next))
}

/** GET: where the application in this browser stands (the cookie is HttpOnly). */
async function handleApplyStatus(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const state = await readApplyState(req, env, url)
  if (!state || state.v !== 2 || state.exp < Math.floor(Date.now() / 1000)) {
    return json({ active: false })
  }
  return json(applyStatus(state))
}

/** Stage 4. POST {consent}: seal the registry line and email the operator. */
async function handleApplySubmit(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { consent?: unknown }
  const state = assertLive(await readApplyState(req, env, url))
  const { wallet, entry } = assertReady(state, body.consent)
  const clearState = clearApplyHeaders(url)
  if (!consumeNonce(state.nonce, state.exp)) {
    return json(
      { error: 'This application was already submitted' },
      409,
      clearState
    )
  }
  if (!allowApplication(wallet)) {
    return json(
      {
        error:
          'An application for this wallet was sent recently. Please wait a few minutes.'
      },
      429,
      clearState
    )
  }

  const signingKey =
    env.APPLICATION_SIGNING_KEY ||
    (isLocalHost(url) ? 'cliox-local-dev-application-key' : '')
  if (!signingKey)
    return json({ error: 'Applications are not configured' }, 503)
  const signature = await signApplication(signingKey, wallet, entry)
  const text = composeEmailBody(wallet, entry, signature)

  if (env.RESEND_API_KEY && env.OPERATOR_EMAIL && env.RESEND_FROM_EMAIL) {
    // Same Resend account and sender as the contact form (upstream uses
    // Resend too), so the only settings are the key, sender and recipient.
    let sent = false
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL,
          to: [env.OPERATOR_EMAIL],
          subject: 'Clio-X verified-provider application',
          text
        })
      })
      sent = res.ok
      if (!sent)
        console.error('application email failed', res.status, await res.text())
    } catch (err) {
      console.error('application email failed', err)
    }
    if (!sent)
      return json(
        { error: 'Could not send the application. Please try again later.' },
        502,
        clearState
      )
  } else if (isLocalHost(url)) {
    // Local dev without a Resend key: print what would be sent.
    console.log(`[provider application] (local dev, not sent)\n${text}`)
  } else {
    return json({ error: 'Applications are not configured' }, 503, clearState)
  }

  return json(
    { submitted: true, wallet, name: entry.name, method: entry.method },
    200,
    clearState
  )
}

const APPLY_ROUTES: Record<
  string,
  {
    method: string
    handler: (req: Request, env: Env, url: URL) => Promise<Response>
  }
> = {
  start: { method: 'POST', handler: handleApplyStart },
  signature: { method: 'POST', handler: handleApplySignature },
  present: { method: 'POST', handler: handleApplyPresent },
  credential: { method: 'POST', handler: handleApplyCredential },
  status: { method: 'GET', handler: handleApplyStatus },
  submit: { method: 'POST', handler: handleApplySubmit }
}

async function handleProviderApplication(
  req: Request,
  env: Env,
  url: URL
): Promise<Response | null> {
  const name = url.pathname.slice('/api/provider-application/'.length)
  const route = APPLY_ROUTES[name]
  if (!route) return null
  if (req.method !== route.method) {
    return json({ error: 'Method not allowed' }, 405)
  }
  try {
    return await route.handler(req, env, url)
  } catch (err) {
    if (err instanceof ApplicationError) {
      return json({ error: err.message }, err.status)
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 2. Ocean Node Policy Server endpoint (POLICY_SERVER_URL)
//    Verifies an id.ldas.jp VC and checks wallet binding against consumerAddress
// ---------------------------------------------------------------------------

async function handlePolicyServer(req: Request, env: Env): Promise<Response> {
  if (req.method === 'GET') {
    return json({
      ok: true,
      service: 'cliox-ldas-policy-server',
      issuer: env.LDAS_ID_ORIGIN || 'https://id.ldas.jp'
    })
  }
  if (req.method !== 'POST')
    return json({ success: false, message: 'Method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const consumerAddress = String(
    body.consumerAddress || body.address || ''
  ).toLowerCase()
  const rawCredential =
    body.credential ||
    body.vc ||
    body.vp_token ||
    body.policyServer?.credential ||
    body.policyServer?.vc ||
    (Array.isArray(body.credentials) ? body.credentials[0] : undefined)

  if (!rawCredential || typeof rawCredential !== 'string') {
    return json(
      {
        success: false,
        httpStatus: 403,
        message: 'Missing id.ldas.jp verifiable credential'
      },
      403
    )
  }

  const issuerOrigin = (env.LDAS_ID_ORIGIN || 'https://id.ldas.jp').replace(
    /\/+$/,
    ''
  )
  try {
    const verified = await verifyLdasCredential(rawCredential, {
      issuerOrigin,
      requireKeyBinding: false
    })

    if (consumerAddress) {
      if (
        !verified.wallet ||
        verified.wallet.toLowerCase() !== consumerAddress
      ) {
        return json(
          {
            success: false,
            httpStatus: 403,
            message:
              'Credential wallet (did:pkh) does not match consumerAddress'
          },
          403
        )
      }
    }

    const requireMember = /^(1|true|yes)$/i.test(
      env.POLICY_REQUIRE_MEMBER || ''
    )
    if (requireMember && verified.memberOf !== 'LDAS') {
      return json(
        {
          success: false,
          httpStatus: 403,
          message: 'LDAS membership claim is required'
        },
        403
      )
    }

    return json({
      success: true,
      httpStatus: 200,
      message: 'Verified by id.ldas.jp',
      subject: verified.sub,
      wallet: verified.wallet,
      affiliation: verified.affiliation
    })
  } catch (err) {
    return json(
      {
        success: false,
        httpStatus: 403,
        message: err instanceof Error ? err.message : 'Verification failed'
      },
      403
    )
  }
}

// ---------------------------------------------------------------------------
// 3. Chatbot proxy endpoints (/api/chatbot/*)
// ---------------------------------------------------------------------------

function chatbotAuthHeaders(env: Env): Record<string, string> {
  return env.CHATBOT_API_KEY ? { 'X-Chatbot-Key': env.CHATBOT_API_KEY } : {}
}

function chatbotSigninRequired(env: Env): boolean {
  return /^(1|true|yes)$/i.test(env.CHATBOT_REQUIRE_SIGNIN || '')
}

async function handleChatbot(
  req: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const sub = url.pathname.replace(/^\/api\/chatbot/, '')

  if (sub === '/signin') {
    const required = chatbotSigninRequired(env)
    const ldasUser = await getLdasSession(req, env, url)
    if (req.method === 'GET') {
      if (!required) return json({ required: false })
      return json({
        required: true,
        address: ldasUser?.wallet || ldasUser?.orcid || null,
        via: ldasUser ? 'ldas-id' : null
      })
    }
    if (req.method === 'DELETE') {
      return json({ required, address: null })
    }
    if (req.method === 'POST') {
      if (!required) return json({ required: false })
      if (ldasUser) {
        return json({
          required: true,
          address: ldasUser.wallet || ldasUser.orcid || ldasUser.sub
        })
      }
      return json(
        {
          error: 'Please sign in with LDAS ID (id.ldas.jp) to use the chatbot'
        },
        401
      )
    }
    return json({ error: 'Method not allowed' }, 405)
  }

  const chatbotApiUrl = env.CHATBOT_API_URL
  if (!chatbotApiUrl) {
    return json({ error: 'Chatbot API URL not configured' }, 500)
  }

  if (sub === '/health' && req.method === 'GET') {
    const r = await fetch(`${chatbotApiUrl}/api/health`, {
      headers: chatbotAuthHeaders(env)
    })
    const text = await r.text()
    return new Response(text, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('Content-Type') || 'application/json'
      }
    })
  }

  if (sub === '/status' && req.method === 'GET') {
    const sessionId = req.headers.get('x-session-id')
    if (!sessionId) return json({ error: 'Session ID header is required' }, 400)
    const r = await fetch(`${chatbotApiUrl}/api/v1/session/knowledge/status`, {
      headers: { ...chatbotAuthHeaders(env), 'X-Session-ID': sessionId }
    })
    return new Response(await r.text(), {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('Content-Type') || 'application/json'
      }
    })
  }

  if (sub === '/session' && req.method === 'DELETE') {
    const sessionId = req.headers.get('x-session-id')
    if (!sessionId) return json({ error: 'Session ID header is required' }, 400)
    const r = await fetch(`${chatbotApiUrl}/api/v1/session/knowledge/session`, {
      method: 'DELETE',
      headers: { ...chatbotAuthHeaders(env), 'X-Session-ID': sessionId }
    })
    return new Response(await r.text(), {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('Content-Type') || 'application/json'
      }
    })
  }

  if (sub === '/upload' && req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string
      knowledgeChunks?: Array<Record<string, any>>
      domains?: string[]
    }
    if (!body.sessionId || !Array.isArray(body.knowledgeChunks)) {
      return json(
        {
          error: 'Invalid payload: sessionId and knowledgeChunks are required'
        },
        400
      )
    }
    const seen = new Set<string>()
    const sanitized = await Promise.all(
      body.knowledgeChunks.map(async (chunk) => {
        const content = typeof chunk?.content === 'string' ? chunk.content : ''
        const metadata = chunk?.metadata ? JSON.stringify(chunk.metadata) : ''
        const hashBuf = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${content}|${metadata}`)
        )
        const fp = Array.from(new Uint8Array(hashBuf))
          .slice(0, 6)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        let newId = `${body.sessionId}_${fp}`
        let salt = 0
        while (seen.has(newId)) {
          salt += 1
          newId = `${body.sessionId}_${fp}_${salt}`
        }
        seen.add(newId)
        return { ...chunk, id: newId }
      })
    )
    const r = await fetch(`${chatbotApiUrl}/api/v1/session/knowledge/upload`, {
      method: 'POST',
      headers: {
        ...chatbotAuthHeaders(env),
        'Content-Type': 'application/json',
        'X-Session-ID': body.sessionId
      },
      body: JSON.stringify({
        session_id: body.sessionId,
        knowledge_chunks: sanitized,
        domains: body.domains
      })
    })
    return new Response(await r.text(), {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('Content-Type') || 'application/json'
      }
    })
  }

  if ((sub === '/chat' || sub === '/stream') && req.method === 'POST') {
    const userHeaders: Record<string, string> = {}
    if (chatbotSigninRequired(env)) {
      const ldasUser = await getLdasSession(req, env, url)
      if (!ldasUser) return json({ error: 'signin_required' }, 401)
      userHeaders['X-Chatbot-User'] =
        ldasUser.wallet || ldasUser.orcid || ldasUser.sub
    }
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string
      message?: string
      config?: unknown
    }
    if (!body.sessionId || !body.message) {
      return json({ error: 'sessionId and message are required' }, 400)
    }
    const isStream = sub === '/stream'
    const upstream = await fetch(`${chatbotApiUrl}/api/v1/session/chat`, {
      method: 'POST',
      headers: {
        ...chatbotAuthHeaders(env),
        ...userHeaders,
        'Content-Type': 'application/json',
        'X-Session-ID': body.sessionId,
        ...(isStream ? { Accept: 'text/event-stream' } : {})
      },
      body: JSON.stringify({
        session_id: body.sessionId,
        message: body.message,
        config: body.config
      })
    })
    if (isStream) {
      if (!upstream.ok || !upstream.body) {
        return json(
          {
            error: `Upstream error: ${await upstream
              .text()
              .catch(() => upstream.statusText)}`
          },
          upstream.status || 502
        )
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        }
      })
    }
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') || 'application/json'
      }
    })
  }

  return json({ error: 'Not found' }, 404)
}

// ---------------------------------------------------------------------------
// 4. Contact form endpoints (/api/contact-resend, /api/contact)
// ---------------------------------------------------------------------------

async function handleContactResend(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, 405)
  }
  if (!env.RESEND_API_KEY) {
    return json(
      {
        success: false,
        message: 'Email service is not configured',
        error: 'Missing API key'
      },
      500
    )
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    email?: string
    message?: string
  }
  if (!body.name || !body.email || !body.message) {
    return json(
      { success: false, message: 'Name, email, and message are required' },
      400
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return json({ success: false, message: 'Invalid email format' }, 400)
  }

  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || 'Clio-X Contact <noreply@ldas.jp>',
      to: [env.CONTACT_EMAIL || 'info@cliox.org'],
      reply_to: body.email,
      subject: `New Contact Form Message from ${body.name}`,
      html: `<p><strong>Name:</strong> ${esc(
        body.name
      )}</p><p><strong>Email:</strong> ${esc(body.email)}</p><pre>${esc(
        body.message
      )}</pre>`
    })
  })
  if (!res.ok) {
    return json({ success: false, message: 'Failed to send email' }, 500)
  }
  return json({
    success: true,
    message:
      'Your message has been sent successfully. We will get back to you soon!'
  })
}

// ---------------------------------------------------------------------------
// 5. Static asset routing & SPA-style rewrites for dynamic paths and /ja/*
// ---------------------------------------------------------------------------

async function serveAsset(
  req: Request,
  env: Env,
  targetPath: string
): Promise<Response> {
  const assetUrl = new URL(req.url)
  assetUrl.pathname = targetPath
  return env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }))
}

function rewriteDynamicPath(pathname: string): string | null {
  // Strip /ja prefix so /ja/<anything> serves the same static bundle;
  // the client reads /ja from window.location.pathname and activates Japanese.
  const stripped =
    pathname === '/ja' || pathname === '/ja/'
      ? '/'
      : pathname.startsWith('/ja/')
      ? pathname.slice(3)
      : pathname

  if (/^\/asset\/[^/]+\/edit\/?$/.test(stripped)) return '/asset/_/edit/'
  if (/^\/experiment\/finding-aid\/[^/]+\/?$/.test(stripped)) {
    return '/experiment/finding-aid/_/'
  }
  if (/^\/asset\/[^/]+\/?$/.test(stripped)) return '/asset/_/'
  if (/^\/profile\/[^/]+\/?$/.test(stripped)) return '/profile/_/'

  if (stripped !== pathname) return stripped
  return null
}

/**
 * Client-side navigation to a dynamic page fetches its getStaticProps data
 * (`/_next/data/<build>/asset/<did>.json`). Only the `_` file is exported, so
 * the fetch 404ed and Next fell back to a full page load, which also dropped
 * the /ja prefix (the page came back in English). The props are the same for
 * every id, so serve the `_` file; Next then reads the id from the address.
 */
function rewriteDataPath(pathname: string): string | null {
  const m = /^\/_next\/data\/([^/]+)\/(?:ja\/)?(.+)\.json$/.exec(pathname)
  if (!m) return null
  const [, build, page] = m
  const shell = rewriteDynamicPath(`/${page}`)
  if (!shell || shell === `/${page}`) return null
  return `/_next/data/${build}${shell.replace(/\/$/, '')}.json`
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const { pathname } = url

    // Legacy redirects (also under /ja, as Next's locale routing did)
    const jaPrefix = pathname === '/ja' || pathname.startsWith('/ja/')
    const redirect = LEGACY_REDIRECTS[jaPrefix ? pathname.slice(3) : pathname]
    if (redirect) {
      const to = `${jaPrefix ? '/ja' : ''}${redirect.to}`
      return Response.redirect(`${url.origin}${to}`, redirect.status)
    }
    const moved = prototypeRedirect(url)
    if (moved) {
      // Relative Location: correct behind any host name or proxy.
      return new Response(null, { status: 307, headers: { Location: moved } })
    }

    // Robots & Sitemap
    if (pathname === '/robots.txt') {
      return new Response(ROBOTS_TXT, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        }
      })
    }
    if (pathname === '/sitemap.xml') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${url.origin}/</loc></url>
  <url><loc>${url.origin}/ja/</loc></url>
  <url><loc>${url.origin}/search/</loc></url>
  <url><loc>${url.origin}/experiment/</loc></url>
  <url><loc>${url.origin}/resources/</loc></url>
</urlset>`
      return new Response(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        }
      })
    }

    // id.ldas.jp authentication endpoints
    if (pathname === '/api/auth/ldas/start') {
      return handleLdasStart(req, env, url)
    }
    if (pathname === '/api/auth/ldas/verify') {
      return handleLdasVerify(req, env, url)
    }
    if (pathname === '/api/auth/ldas/me') {
      return handleLdasMe(req, env, url)
    }
    if (pathname === '/api/auth/ldas/logout') {
      return handleLdasLogout(url)
    }
    if (pathname.startsWith('/api/provider-application/')) {
      const res = await handleProviderApplication(req, env, url)
      if (res) return res
    }

    // [local patch] Green reward: the checker signs a claim for a finished job
    if (pathname === '/api/green-reward/quote') {
      if (req.method !== 'POST')
        return json({ ok: false, reason: 'POST only' }, 405)
      const body = await req.json().catch(() => null)
      const r = await handleQuoteBody(
        body,
        {
          checkerKey: env.GREEN_REWARD_CHECKER_KEY,
          contract: env.GREEN_REWARD_CONTRACT
        },
        realEnvs.options as RealEnvEntry[]
      )
      return json(r.body, r.status)
    }

    // Ocean Node policy server
    if (pathname === '/api/policy-server') {
      return handlePolicyServer(req, env)
    }

    // Chatbot & Contact APIs
    if (pathname.startsWith('/api/chatbot/')) {
      return handleChatbot(req, env, url)
    }
    if (pathname === '/api/contact-resend') {
      return handleContactResend(req, env)
    }

    // Rewrite /ja/*, /asset/*, /profile/* to their exported static shells
    const rewritten = rewriteDynamicPath(pathname)
    if (rewritten) {
      return serveAsset(req, env, rewritten)
    }
    const data = rewriteDataPath(pathname)
    if (data) return serveAsset(req, env, data)

    return env.ASSETS.fetch(req)
  }
}
