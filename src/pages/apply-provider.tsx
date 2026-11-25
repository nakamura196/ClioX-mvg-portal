// [local patch] Verified-provider mark and application (id.ldas.jp). Not in upstream; see scripts/local-patches.txt.
import { ReactElement, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { useTranslation } from 'react-i18next'
import Page from '@shared/Page'
import Button from '@shared/atoms/Button'
import styles from './apply-provider.module.css'
import { APPLY_RETURN_KEY, APPLY_RESULT_KEY } from '@utils/providerApply'

type Result = { ok: boolean; error?: string }

export default function ApplyProviderPage(): ReactElement {
  const router = useRouter()
  const { t } = useTranslation('common')
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
    <Page
      title={t('providerApply.title')}
      description={t('providerApply.description')}
      uri={router.route}
    >
      {result?.ok ? (
        <section className={styles.apply} data-testid="apply-submitted">
          <h2>{t('providerApply.submittedTitle')}</h2>
          <p>{t('providerApply.submittedBody')}</p>
        </section>
      ) : (
        <section className={styles.apply}>
          {result && !result.ok && (
            <div
              role="alert"
              style={{ color: '#c0392b', marginBottom: '1rem' }}
            >
              <strong>{t('providerApply.errorTitle')}</strong>
              <p>{result.error}</p>
            </div>
          )}
          <p>{t('providerApply.intro')}</p>
          <h3>{t('providerApply.publishedTitle')}</h3>
          <ul>
            {published.map((key) => (
              <li key={key}>{t(`providerApply.${key}`)}</li>
            ))}
          </ul>
          <p>{t('providerApply.notPublished')}</p>
          <p>
            {address
              ? t('providerApply.connected', { address })
              : t('providerApply.needWallet')}
          </p>
          <label style={{ display: 'block', margin: '1rem 0' }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            {t('providerApply.consent')}
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
            {busy ? t('providerApply.starting') : t('providerApply.start')}
          </Button>
        </section>
      )}
    </Page>
  )
}
