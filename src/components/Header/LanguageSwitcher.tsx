import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { locales, localeNames, Locale } from '../../i18n'
import styles from './LanguageSwitcher.module.css'

/**
 * Switches between the locales configured in `next.config.js`. Navigating with
 * the `locale` option keeps the current route and query string, so the user
 * stays on the page they were reading.
 */
export default function LanguageSwitcher(): ReactElement {
  const router = useRouter()
  const { t } = useTranslation('common')
  const activeLocale = (router.locale || router.defaultLocale) as Locale

  function switchTo(locale: Locale) {
    router.push({ pathname: router.pathname, query: router.query }, undefined, {
      locale,
      scroll: false
    })
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
