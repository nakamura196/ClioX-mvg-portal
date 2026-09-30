import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import getConfig from 'next/config'
import { utils } from 'ethers'
import type { NextApiRequest, NextApiResponse } from 'next'

// ウォレットの署名でチャットボットにサインインする（任意機能）。
//
// CHATBOT_REQUIRE_SIGNIN が true のときだけ働く。無ければ /api/chatbot/* は
// これまでどおり誰でも呼べる（upstream の運用は変わらない）。
//
// 流れ: ブラウザがアドレスを送る → サーバが署名してほしい文を返す（文の中の
// Nonce はサーバの秘密で HMAC したもので、サーバは何も覚えない）→ ウォレット
// が署名 → サーバが署名者を復元して一致を確かめ、HttpOnly の cookie を渡す →
// chat / stream はその cookie のアドレスを X-Chatbot-User としてチャット
// ボットに送る。件数の上限はチャットボット側（server.py）が数える。
//
// 秘密は CHATBOT_SIGNIN_SECRET、無ければ CHATBOT_API_KEY から作る。
// Vercel では process.env が関数に見えないことがあるので serverRuntimeConfig
// から読む（upstreamAuth.ts と同じ）。

const COOKIE = 'cliox_chatbot_signin'
const MESSAGE_TTL_S = 10 * 60
const SIGNIN_TTL_S = 7 * 24 * 60 * 60

function setting(name: string): string | undefined {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.[name] || process.env[name]
}

export function signinRequired(): boolean {
  return /^(1|true|yes)$/i.test(setting('CHATBOT_REQUIRE_SIGNIN') || '')
}

function secret(): Buffer {
  const base =
    setting('CHATBOT_SIGNIN_SECRET') || setting('CHATBOT_API_KEY') || ''
  if (!base) throw new Error('no secret for chatbot sign-in')
  return createHmac('sha256', base).update('cliox-chatbot-signin').digest()
}

function mac(text: string): string {
  return createHmac('sha256', secret()).update(text).digest('base64url')
}

function sameMac(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function host(req: NextApiRequest): string {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '')
}

/** The text the wallet is asked to sign (EIP-4361 layout). */
export function signinMessage(req: NextApiRequest, address: string): string {
  const addr = utils.getAddress(address)
  const issued = new Date().toISOString()
  const rand = randomBytes(8).toString('hex')
  const nonce = `${rand}${mac(`${addr}|${issued}|${rand}`).slice(0, 22)}`
  return [
    `${host(req)} wants you to sign in with your Ethereum account:`,
    addr,
    '',
    'Sign in to ask the chatbot questions. This is a signature only: it sends no transaction and costs nothing.',
    '',
    `URI: https://${host(req)}`,
    'Version: 1',
    `Nonce: ${nonce}`,
    `Issued At: ${issued}`
  ].join('\n')
}

/** Checks a signed message; returns the address, or throws with the reason. */
export function verifySignin(
  req: NextApiRequest,
  message: string,
  signature: string
): string {
  const lines = message.split('\n')
  const addr = utils.getAddress(lines[1] || '')
  const field = (name: string) =>
    lines.find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2) || ''
  const nonce = field('Nonce')
  const issued = field('Issued At')
  const rand = nonce.slice(0, 16)
  if (!lines[0]?.startsWith(`${host(req)} `))
    throw new Error('message is for another site')
  if (!sameMac(nonce.slice(16), mac(`${addr}|${issued}|${rand}`).slice(0, 22)))
    throw new Error('message was not issued by this site')
  const age = (Date.now() - Date.parse(issued)) / 1000
  if (!(age >= -60 && age <= MESSAGE_TTL_S)) throw new Error('message expired')
  if (utils.getAddress(utils.verifyMessage(message, signature)) !== addr)
    throw new Error('signature does not match the address')
  return addr
}

export function setSigninCookie(res: NextApiResponse, address: string): void {
  const expires = Math.floor(Date.now() / 1000) + SIGNIN_TTL_S
  const body = `${address}.${expires}`
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${body}.${mac(
      body
    )}; Path=/api/chatbot; HttpOnly; Secure; SameSite=Lax; Max-Age=${SIGNIN_TTL_S}`
  )
}

export function clearSigninCookie(res: NextApiResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; Path=/api/chatbot; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  )
}

/** The signed-in address from the cookie, or null. */
export function signedInAddress(req: NextApiRequest): string | null {
  const value = req.cookies?.[COOKIE]
  if (!value) return null
  const [address, expires, sig] = value.split('.')
  if (!address || !expires || !sig) return null
  try {
    if (!sameMac(sig, mac(`${address}.${expires}`))) return null
  } catch {
    return null
  }
  if (Number(expires) < Date.now() / 1000) return null
  return address
}

/**
 * For chat / stream: the header to send upstream, or null after answering
 * 401 when sign-in is required and missing.
 */
export function chatbotUserHeader(
  req: NextApiRequest,
  res: NextApiResponse
): Record<string, string> | null {
  if (!signinRequired()) return {}
  const address = signedInAddress(req)
  if (!address) {
    res.status(401).json({ error: 'signin_required' })
    return null
  }
  return { 'X-Chatbot-User': address }
}
