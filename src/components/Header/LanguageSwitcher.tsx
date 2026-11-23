import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { locales, localeNames, Locale } from '../../i18n'
import useActiveLocale from '../../i18n/useActiveLocale'
import styles from './LanguageSwitcher.module.css'

/**
 * Switches between English and Japanese in both Next.js i18n-routed builds
 * (Vercel/dev) and static-export builds (Cloudflare Workers Assets).
 */
export default function LanguageSwitcher(): ReactElement {
  const router = useRouter()
  const { t, i18n } = useTranslation('common')
  const activeLocale = useActiveLocale()

  function switchTo(locale: Locale) {
    if (router.locale) {
      router.push(
        { pathname: router.pathname, query: router.query },
        undefined,
        {
          locale,
          scroll: false
        }
      )
      return
    }
    i18n.changeLanguage(locale)
    if (typeof window !== 'undefined') {
      const { pathname, search, hash } = window.location
      const stripped = pathname.replace(/^\/ja(?=\/|$)/, '') || '/'
      const nextPath =
        locale === 'ja'
          ? stripped === '/'
            ? '/ja/'
            : `/ja${stripped}`
          : stripped
      window.history.replaceState(null, '', `${nextPath}${search}${hash}`)
    }
  }

  return (
    <div className={styles.switcher} aria-label={t('language.label')}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          className={styles.button}
          onClick={() => switchTo(locale)}
          aria-current={locale === activeLocale}
          style={{ opacity: locale === activeLocale ? 1 : 0.55 }}
        >
          {locale === 'ja' ? localeNames.ja : 'EN'}
        </button>
      ))}
    </div>
  )
}
