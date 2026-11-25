// [local patch] Japanese / English interface (react-i18next). Not in upstream; see scripts/local-patches.txt.
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import type { Locale } from './index'

/**
 * Returns the active locale in both Next.js i18n-routed builds (Vercel/dev)
 * and static-export builds (Cloudflare Workers Assets), where `router.locale`
 * is undefined and the language lives in `i18n.language` / `/ja` URL prefix.
 */
export function useActiveLocale(): Locale {
  const router = useRouter()
  const { i18n } = useTranslation('common')

  if (router.locale === 'ja' || router.locale === 'en') {
    return router.locale
  }
  if (i18n?.language?.startsWith('ja')) {
    return 'ja'
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.pathname === '/ja' ||
      window.location.pathname.startsWith('/ja/'))
  ) {
    return 'ja'
  }
  return 'en'
}

export default useActiveLocale
