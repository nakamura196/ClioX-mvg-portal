// [local patch] Cloudflare static export and LDAS ID sign-in. Not in upstream; see scripts/local-patches.txt.
import { ReactElement, useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useLdasAuth } from '@context/LdasAuth'
import useActiveLocale from '../../i18n/useActiveLocale'
import styles from './LdasIdButton.module.css'

function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

export default function LdasIdButton(): ReactElement | null {
  const { user, authenticated, loading, issuerOrigin, login, logout } =
    useLdasAuth()
  const { address: connectedWallet } = useAccount()
  const locale = useActiveLocale()
  const ja = locale === 'ja'
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  // The header button exists only for chatbot sign-in. When the Worker does
  // not require it (CHATBOT_REQUIRE_SIGNIN off, as in production), hide it;
  // pages that need LDAS ID (e.g. /experiment/apply-provider) have their own step.
  const [chatbotSigninRequired, setChatbotSigninRequired] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/chatbot/signin')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setChatbotSigninRequired(Boolean(d?.required))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (!chatbotSigninRequired) return null

  if (loading) {
    return (
      <div className={styles.wrap}>
        <button type="button" className={styles.button} disabled>
          LDAS ID
        </button>
      </div>
    )
  }

  if (!authenticated || !user) {
    return (
      <div className={styles.wrap}>
        <button
          type="button"
          className={styles.button}
          onClick={() => login()}
          title={
            ja
              ? 'id.ldas.jp（ORCID / 所属 / ウォレット証明書）でサインイン'
              : 'Sign in with LDAS ID (id.ldas.jp verifiable credential)'
          }
        >
          <span className={styles.dotOff} aria-hidden="true" />
          LDAS ID
        </button>
      </div>
    )
  }

  const walletMatches =
    Boolean(user.wallet && connectedWallet) &&
    user.wallet!.toLowerCase() === connectedWallet!.toLowerCase()

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonActive}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.dotOn} aria-hidden="true" />
        <span className={styles.name}>{user.name}</span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="LDAS ID">
          <div className={styles.header}>
            <strong>{user.name}</strong>
            {user.memberOf && (
              <span className={styles.badge}>{user.memberOf}</span>
            )}
          </div>

          <dl className={styles.meta}>
            {user.affiliation && (
              <div>
                <dt>{ja ? '所属' : 'Affiliation'}</dt>
                <dd>{user.affiliation}</dd>
              </div>
            )}
            {user.orcid && (
              <div>
                <dt>ORCID</dt>
                <dd>
                  <a href={user.orcid} target="_blank" rel="noreferrer">
                    {user.orcid.replace(/^https?:\/\/orcid\.org\//, '')}
                  </a>
                </dd>
              </div>
            )}
            {user.wallet && (
              <div>
                <dt>{ja ? '証明書ウォレット' : 'Credential Wallet'}</dt>
                <dd>
                  <code>{shortAddr(user.wallet)}</code>
                  {connectedWallet && (
                    <span
                      className={
                        walletMatches ? styles.matchOk : styles.matchWarn
                      }
                    >
                      {walletMatches
                        ? ja
                          ? '（接続中と一致）'
                          : ' (matches connected)'
                        : ja
                        ? '（接続中と不一致）'
                        : ' (differs from connected)'}
                    </span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>{ja ? '発行元' : 'Issuer'}</dt>
              <dd>
                <code>{user.issuer}</code> ({user.format})
              </dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <a
              href={issuerOrigin}
              target="_blank"
              rel="noreferrer"
              className={styles.linkBtn}
            >
              {ja ? 'id.ldas.jp を開く' : 'Manage on id.ldas.jp'}
            </a>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={async () => {
                setOpen(false)
                await logout()
              }}
            >
              {ja ? 'サインアウト' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
