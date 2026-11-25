// sessionStorage keys shared by the apply page and /ldas-callback.
export const APPLY_RETURN_KEY = 'cliox_apply_return_to'
export const APPLY_RESULT_KEY = 'cliox_apply_result'

export const APPLY_PATH = '/experiment/apply-provider'

const API = '/api/provider-application'

/** Where the application in this browser stands (from the Worker's sealed cookie). */
export interface ApplyStatus {
  active: boolean
  address?: string
  message?: string
  signer?: string | null
  credential?: {
    name: string
    method: string[]
    selfDeclaredName: boolean
  } | null
  expiresAt?: string
}

async function call<T>(
  name: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API}/${name}`, {
    method: init.method || 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data as T
}

export function fetchApplyStatus(): Promise<ApplyStatus> {
  return call<ApplyStatus>('status', { method: 'GET' })
}

/** Stage 1: a fresh nonce and the exact message the wallet will sign. */
export function startApplication(
  wallet: string
): Promise<{ nonce: string; message: string }> {
  return call('start', { body: { wallet, consent: true } })
}

/** Stage 2: the Worker recovers the signer itself. */
export function sendSignature(signature: string): Promise<ApplyStatus> {
  return call<ApplyStatus>('signature', { body: { signature } })
}

/** Stage 3a: go to id.ldas.jp; /ldas-callback brings the presentation back. */
export async function presentCredential(): Promise<void> {
  const { authorizeUrl } = await call<{ authorizeUrl: string }>('present')
  window.sessionStorage.setItem(APPLY_RETURN_KEY, window.location.pathname)
  window.location.href = authorizeUrl
}

/** Stage 4. */
export function submitApplication(): Promise<{ submitted: boolean }> {
  return call('submit', { body: { consent: true } })
}

/** Returns (and clears) the path to go back to if an application is in progress. */
export function takeApplyReturn(): string | null {
  const saved = window.sessionStorage.getItem(APPLY_RETURN_KEY)
  if (!saved) return null
  window.sessionStorage.removeItem(APPLY_RETURN_KEY)
  return saved.startsWith('/') && !saved.startsWith('//') ? saved : APPLY_PATH
}

/**
 * Stage 3b, called by /ldas-callback: sends the presentation to the Worker
 * for verification, stores an error (if any) for the apply page, and returns
 * the path to go back to. Nothing is submitted yet.
 */
export async function sendApplicationCredential(
  vpToken: string,
  state: string | undefined,
  returnPath: string
): Promise<string> {
  try {
    await call('credential', { body: { vp_token: vpToken, state } })
  } catch (err) {
    window.sessionStorage.setItem(
      APPLY_RESULT_KEY,
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Request failed'
      })
    )
  }
  return returnPath
}
