// [local patch] Verified-provider mark and application (id.ldas.jp). Not in upstream; see scripts/local-patches.txt.
import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useLdasRegistry } from '@hooks/useLdasRegistry'
import { describeMethod, LdasProvider } from '@utils/ldasRegistry'
import styles from './index.module.css'

export function useVerifiedMarkTitle(): (provider: LdasProvider) => string {
  const { t } = useTranslation('common')
  return (provider) => {
    const methods = (provider.method || []).map((m) => {
      const { kind, value } = describeMethod(m)
      if (kind === 'domain' && value) {
        return t('verifiedMark.methodDomain', { domain: value })
      }
      if (kind === 'orcid') return t('verifiedMark.methodOrcid')
      if (kind === 'gakunin') return t('verifiedMark.methodGakunin')
      return value ? `${kind}: ${value}` : kind
    })
    const method = methods.length
      ? methods.join(', ')
      : t('verifiedMark.methodUnknown')
    const date = (provider.verifiedAt || '').slice(0, 10)
    const base = provider.selfDeclaredName
      ? t('verifiedMark.tooltipSelfDeclared', { method })
      : t('verifiedMark.tooltip', { method })
    return date ? `${base} ${t('verifiedMark.verifiedOn', { date })}` : base
  }
}

/**
 * Badge for providers verified by id.ldas.jp. Distinct from the upstream
 * Pontus-X verified names (which are shown as plain names).
 * Renders nothing while the registry loads, if it fails, or if the address
 * is not listed.
 */
export default function VerifiedMark({
  account,
  className
}: {
  account: string
  className?: string
}): ReactElement {
  const { getProvider } = useLdasRegistry()
  const { t } = useTranslation('common')
  const getTitle = useVerifiedMarkTitle()
  const provider = getProvider(account)
  if (!provider) return null

  const title = getTitle(provider)
  return (
    <span
      className={`${styles.mark} ${className || ''}`}
      title={title}
      aria-label={title}
      data-testid="ldas-verified-mark"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.icon}>
        <path
          fill="currentColor"
          d="M8 0l2.2 1.3 2.6-.2 1.1 2.3 2.2 1.4-.6 2.5.6 2.5-2.2 1.4-1.1 2.3-2.6-.2L8 16l-2.2-1.3-2.6.2-1.1-2.3L-.1 11.2l.6-2.5-.6-2.5 2.2-1.4 1.1-2.3 2.6.2z"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.8 8.2l2.3 2.3 4.2-4.6"
        />
      </svg>
      <span className={styles.text}>{t('verifiedMark.label')}</span>
    </span>
  )
}
