import { ReactElement, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import Page from '@shared/Page'
import Button from '@shared/atoms/Button'
import styles from './Page.module.css'
import { useVerifiedProviderContent, fill } from './content'
import { APPLY_RETURN_KEY, APPLY_RESULT_KEY } from './lib/providerApply'

type Result = { ok: boolean; error?: string }

export default function ApplyProviderPage(): ReactElement {
  const router = useRouter()
  const { apply: c } = useVerifiedProviderContent()
  const { address } = useAccount()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(APPLY_RESULT_KEY)
      if (raw) {
        window.sessionStorage.removeItem(APPLY_RESULT_KEY)
        setResult(JSON.parse(raw))
      }
    } catch {
      // sessionStorage unavailable: show the form
    }
  }, [])

  async function start(): Promise<void> {
    if (!address) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/provider-application/start', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.authorizeUrl) {
        throw new Error(data.error || res.statusText)
      }
      window.sessionStorage.setItem(APPLY_RETURN_KEY, window.location.pathname)
      window.location.href = data.authorizeUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const published = [
    'publishedWallet',
    'publishedName',
    'publishedMethod',
    'publishedDate'
  ]

  return (
    <Page title={c.title} description={c.description} uri={router.route}>
      {result?.ok ? (
        <section className={styles.apply} data-testid="apply-submitted">
          <h2>{c.submittedTitle}</h2>
          <p>{c.submittedBody}</p>
        </section>
      ) : (
        <section className={styles.apply}>
          {result && !result.ok && (
            <div
              role="alert"
              style={{ color: '#c0392b', marginBottom: '1rem' }}
            >
              <strong>{c.errorTitle}</strong>
              <p>{result.error}</p>
            </div>
          )}
          <p>{c.intro}</p>
          <h3>{c.publishedTitle}</h3>
          <ul>
            {published.map((key) => (
              <li key={key}>{c[key as keyof typeof c]}</li>
            ))}
          </ul>
          <p>{c.notPublished}</p>
          <h3>{c.privacyTitle}</h3>
          <ul>
            {c.privacyItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            {c.contactLabel}: {c.contact}
          </p>
          <p>{address ? fill(c.connected, { address }) : c.needWallet}</p>
          <label style={{ display: 'block', margin: '1rem 0' }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            {c.consent}
          </label>
          {error && (
            <p role="alert" style={{ color: '#c0392b' }}>
              {error}
            </p>
          )}
          <Button
            style="primary"
            onClick={() => start()}
            disabled={!address || !consent || busy}
          >
            {busy ? c.starting : c.start}
          </Button>
        </section>
      )}
    </Page>
  )
}
