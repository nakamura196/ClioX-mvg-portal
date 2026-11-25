// [local patch] Cloudflare static export and LDAS ID sign-in. Not in upstream; see scripts/local-patches.txt.
import { ReactElement, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import Container from '@shared/atoms/Container'
import { consumeLdasReturnPath, useLdasAuth } from '@context/LdasAuth'
import { APPLY_RETURN_KEY, APPLY_RESULT_KEY } from '@utils/providerApply'
import useActiveLocale from '../i18n/useActiveLocale'

export default function LdasCallbackPage(): ReactElement {
  const router = useRouter()
  const { refresh } = useLdasAuth()
  const locale = useActiveLocale()
  const ja = locale === 'ja'
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const vpToken = params.get('vp_token')
    const vc = params.get('vc')
    const state = params.get('state')

    // Remove sensitive credential from address bar immediately
    window.history.replaceState(null, '', window.location.pathname)

    if (!vpToken && !vc) {
      setStatus('error')
      setErrorMsg(
        ja
          ? 'id.ldas.jp からの証明書が受け取れませんでした。もう一度サインインしてください。'
          : 'No credential was returned from id.ldas.jp. Please try signing in again.'
      )
      return
    }

    // Provider application started from /apply-provider: submit it instead of signing in.
    const applyReturn = window.sessionStorage.getItem(APPLY_RETURN_KEY)
    if (applyReturn && vpToken) {
      window.sessionStorage.removeItem(APPLY_RETURN_KEY)
      ;(async () => {
        let result: { ok: boolean; error?: string }
        try {
          const res = await fetch('/api/provider-application/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              vp_token: vpToken,
              state: state || undefined
            })
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
        router.replace(
          applyReturn.startsWith('/') && !applyReturn.startsWith('//')
            ? applyReturn
            : '/apply-provider'
        )
      })()
      return
    }

    ;(async () => {
      try {
        const res = await fetch('/api/auth/ldas/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            vp_token: vpToken || undefined,
            vc: vc || undefined,
            state: state || undefined
          })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || res.statusText)
        }
        await refresh()
        const nextPath = consumeLdasReturnPath()
        router.replace(nextPath)
      } catch (err) {
        setStatus('error')
        setErrorMsg(
          err instanceof Error
            ? err.message
            : ja
            ? '証明書の検証に失敗しました。'
            : 'Credential verification failed.'
        )
      }
    })()
  }, [ja, refresh, router])

  return (
    <Page
      title={ja ? 'LDAS ID サインイン' : 'LDAS ID Sign-In'}
      description={
        ja
          ? 'id.ldas.jp の証明書を検証しています'
          : 'Verifying your credential from id.ldas.jp'
      }
      uri="/ldas-callback"
      noPageHeader
    >
      <Container narrow>
        <div style={{ padding: '4rem 0', textAlign: 'center' }}>
          {status === 'verifying' ? (
            <>
              <h2>
                {ja
                  ? 'LDAS ID の証明書を検証しています…'
                  : 'Verifying your LDAS ID credential…'}
              </h2>
              <p style={{ opacity: 0.75, marginTop: '0.75rem' }}>
                {ja
                  ? 'Ed25519 署名・鍵束縛 (kb+jwt)・失効リストを確認しています。'
                  : 'Checking Ed25519 signature, key binding (kb+jwt), and revocation status.'}
              </p>
            </>
          ) : (
            <>
              <h2>
                {ja
                  ? 'サインインできませんでした'
                  : 'Sign-in could not complete'}
              </h2>
              <p style={{ color: '#c0392b', marginTop: '0.75rem' }}>
                {errorMsg}
              </p>
              <div
                style={{
                  marginTop: '1.5rem',
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/api/auth/ldas/start'
                  }}
                  style={{
                    padding: '0.5rem 1.1rem',
                    borderRadius: '6px',
                    border: '1px solid currentColor',
                    cursor: 'pointer'
                  }}
                >
                  {ja ? 'もう一度試す' : 'Try again'}
                </button>
                <button
                  type="button"
                  onClick={() => router.replace('/')}
                  style={{
                    padding: '0.5rem 1.1rem',
                    borderRadius: '6px',
                    border: '1px solid #888',
                    cursor: 'pointer'
                  }}
                >
                  {ja ? 'トップへ戻る' : 'Back to home'}
                </button>
              </div>
            </>
          )}
        </div>
      </Container>
    </Page>
  )
}
