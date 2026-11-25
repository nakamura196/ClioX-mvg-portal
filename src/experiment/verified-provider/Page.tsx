import { ReactElement, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAccount, useSigner } from 'wagmi'
import Page from '@shared/Page'
import Button from '@shared/atoms/Button'
import styles from './Page.module.css'
import { useVerifiedProviderContent, fill } from './content'
import {
  APPLY_RESULT_KEY,
  ApplyStatus,
  fetchApplyStatus,
  presentCredential,
  sendSignature,
  startApplication,
  submitApplication
} from './lib/providerApply'

const errorStyle = { color: '#c0392b' }

/**
 * Plan B: connect wallet → consent → wallet signature (EIP-191) → id.ldas.jp
 * credential → submit. The Worker keeps the application state in a sealed
 * cookie; this page only reads it back through /status.
 */
export default function ApplyProviderPage(): ReactElement {
  const router = useRouter()
  const { apply: c } = useVerifiedProviderContent()
  const { address } = useAccount()
  const { data: signer } = useSigner()
  const [status, setStatus] = useState<ApplyStatus>({ active: false })
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<'' | 'sign' | 'present' | 'submit'>('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const s = await fetchApplyStatus()
      setStatus(s)
      if (s.active) setConsent(true) // consent was required to start
    } catch {
      setStatus({ active: false })
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(APPLY_RESULT_KEY)
      if (raw) {
        window.sessionStorage.removeItem(APPLY_RESULT_KEY)
        const r = JSON.parse(raw) as { ok: boolean; error?: string }
        if (!r.ok && r.error) setError(r.error)
      }
    } catch {
      // sessionStorage unavailable
    }
    refresh()
  }, [refresh])

  async function run(
    kind: 'sign' | 'present' | 'submit',
    fn: () => Promise<void>
  ): Promise<void> {
    setBusy(kind)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  const sign = (): Promise<void> =>
    run('sign', async () => {
      if (!address || !signer) throw new Error(c.needWallet)
      const started = await startApplication(address)
      setMessage(started.message)
      const signature = await signer.signMessage(started.message)
      setStatus(await sendSignature(signature))
      setMessage('')
    })

  const present = (): Promise<void> =>
    run('present', async () => {
      await presentCredential()
      // Navigates away; keep the button busy until the page unloads.
      await new Promise(() => undefined)
    })

  const submit = (): Promise<void> =>
    run('submit', async () => {
      await submitApplication()
      setSubmitted(true)
    })

  const signedBy = status.active ? status.signer : null
  const signerMatches =
    !!signedBy && !!address && signedBy.toLowerCase() === address.toLowerCase()
  const credential = status.active ? status.credential : null
  const expired =
    status.active &&
    !!status.expiresAt &&
    new Date(status.expiresAt).getTime() < Date.now()
  const shownMessage = message || (status.active && status.message) || ''

  const published = [
    'publishedWallet',
    'publishedName',
    'publishedMethod',
    'publishedDate'
  ]

  if (submitted) {
    return (
      <Page title={c.title} description={c.description} uri={router.route}>
        <section className={styles.apply} data-testid="apply-submitted">
          <h2>{c.submittedTitle}</h2>
          <p>{c.submittedBody}</p>
        </section>
      </Page>
    )
  }

  return (
    <Page title={c.title} description={c.description} uri={router.route}>
      <section className={styles.apply}>
        <p>{c.intro}</p>
        <h3>{c.publishedTitle}</h3>
        <ul>
          {published.map((key) => (
            <li key={key}>{c[key as keyof typeof c] as string}</li>
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

        {error && (
          <div role="alert" style={errorStyle}>
            <strong>{c.errorTitle}</strong>
            <p>{error}</p>
          </div>
        )}

        <h3>{c.step1}</h3>
        <p>{address ? fill(c.connected, { address }) : c.needWallet}</p>

        <h3>{c.step2}</h3>
        <label style={{ display: 'block', margin: '0.5rem 0 1rem' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />{' '}
          {c.consent}
        </label>

        <h3>{c.step3}</h3>
        <p>{c.signExplain}</p>
        {shownMessage && (
          <>
            <p>{c.signMessageLabel}:</p>
            <pre
              data-testid="apply-message"
              style={{ whiteSpace: 'pre-wrap', fontSize: '0.85em' }}
            >
              {shownMessage}
            </pre>
          </>
        )}
        {signedBy && <p>{fill(c.signed, { address: signedBy })}</p>}
        {signedBy && address && !signerMatches && (
          <p role="alert" style={errorStyle}>
            {c.signerDiffers}
          </p>
        )}
        {expired && (
          <p role="alert" style={errorStyle}>
            {c.expired}
          </p>
        )}
        <Button
          style={signedBy ? 'text' : 'primary'}
          onClick={() => sign()}
          disabled={!address || !signer || !consent || busy !== ''}
        >
          {busy === 'sign' ? c.signing : c.sign}
        </Button>

        <h3>{c.step4}</h3>
        {credential && (
          <p>
            {fill(c.presented, {
              name: credential.name,
              method: credential.method.join(', ') || '-'
            })}
          </p>
        )}
        <Button
          style={credential ? 'text' : 'primary'}
          onClick={() => present()}
          disabled={!signerMatches || expired || busy !== ''}
        >
          {busy === 'present' ? c.presenting : c.present}
        </Button>

        <h3>{c.step5}</h3>
        <Button
          style="primary"
          onClick={() => submit()}
          disabled={
            !consent || !signerMatches || !credential || expired || busy !== ''
          }
        >
          {busy === 'submit' ? c.submitting : c.submit}
        </Button>
      </section>
    </Page>
  )
}
