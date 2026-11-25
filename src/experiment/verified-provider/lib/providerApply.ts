// sessionStorage keys shared by the apply page and /ldas-callback.
export const APPLY_RETURN_KEY = 'cliox_apply_return_to'
export const APPLY_RESULT_KEY = 'cliox_apply_result'

export const APPLY_PATH = '/experiment/apply-provider'

/** Returns (and clears) the path to go back to if an application is in progress. */
export function takeApplyReturn(): string | null {
  const saved = window.sessionStorage.getItem(APPLY_RETURN_KEY)
  if (!saved) return null
  window.sessionStorage.removeItem(APPLY_RETURN_KEY)
  return saved.startsWith('/') && !saved.startsWith('//') ? saved : APPLY_PATH
}

/**
 * Sends the presentation to the Worker, stores the outcome for the apply
 * page, and returns the path to show it on.
 */
export async function submitApplication(
  vpToken: string,
  state: string | undefined,
  returnPath: string
): Promise<string> {
  let result: { ok: boolean; error?: string }
  try {
    const res = await fetch('/api/provider-application/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ vp_token: vpToken, state })
    })
    const data = await res.json().catch(() => ({}))
    result = res.ok
      ? { ok: true }
      : { ok: false, error: data.error || res.statusText }
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : 'Request failed'
    }
  }
  window.sessionStorage.setItem(APPLY_RESULT_KEY, JSON.stringify(result))
  return returnPath
}
