import en from './locales/en.json'
import ja from './locales/ja.json'

export const locales = ['en', 'ja'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

// Human-readable names, always shown in their own language so the switcher is
// usable no matter which locale is currently active.
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ja: '日本語'
}

/**
 * next-i18next config passed to `appWithTranslation` in `_app.tsx`.
 *
 * Translations are bundled inline via `resources` instead of being read from
 * disk by the filesystem backend. That is what lets every page work without
 * adding `serverSideTranslations()` to its `getStaticProps`/`getServerSideProps`
 * — important here, since most pages in this app have no data-fetching function
 * at all, and adding one to each would balloon the diff against upstream.
 *
 * Keep `i18n.locales` / `i18n.defaultLocale` in sync with `next.config.js`,
 * which needs them at build time for Next's locale routing.
 */
export const nextI18NextConfig = {
  i18n: {
    locales: [...locales],
    defaultLocale,
    // Opt out of Accept-Language based redirects: `/` always serves English and
    // the user picks Japanese explicitly via the header switcher.
    localeDetection: false as const
  },
  defaultNS: 'common',
  fallbackLng: defaultLocale,
  resources: {
    en: { common: en },
    ja: { common: ja }
  },
  react: { useSuspense: false }
}

export default nextI18NextConfig
