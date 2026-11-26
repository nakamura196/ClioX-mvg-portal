// [local patch] Japanese / English interface (react-i18next). Not in upstream; see scripts/local-patches.txt.
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'

function isJaPath(pathname: string): boolean {
  return pathname === '/ja' || pathname.startsWith('/ja/')
}

/**
 * Does in the static export (Cloudflare Workers Assets) what Next's locale
 * routing did on Vercel, where `router.locale` is set and this hook does nothing:
 *
 * - Sets `<html lang>`. Next wrote it from the locale; the export writes none,
 *   so Japanese pages had no language for screen readers and font choice.
 * - Keeps the /ja prefix after client-side navigation. `<Link href="/search">`
 *   and `router.push('/publish/2')` no longer add it, so the address bar
 *   dropped /ja while the page stayed Japanese, and a reload or a copied link
 *   came back in English. Next's own history state is kept as is.
 */
export function useStaticExportLocale(): void {
  const router = useRouter()
  const { i18n } = useTranslation('common')
  const { events, locale } = router

  useEffect(() => {
    if (locale || typeof window === 'undefined') return

    // The language itself comes from i18n (set from the /ja address in _app,
    // or by the language switcher); only the address and <html lang> follow it.
    const sync = () => {
      const lang = i18n.language?.startsWith('ja') ? 'ja' : 'en'
      document.documentElement.lang = lang
      if (lang !== 'ja' || isJaPath(window.location.pathname)) return
      const { pathname, search, hash } = window.location
      window.history.replaceState(
        window.history.state,
        '',
        `/ja${pathname}${search}${hash}`
      )
    }

    sync()
    i18n.on('languageChanged', sync)
    events.on('routeChangeComplete', sync)
    events.on('hashChangeComplete', sync)
    return () => {
      i18n.off('languageChanged', sync)
      events.off('routeChangeComplete', sync)
      events.off('hashChangeComplete', sync)
    }
  }, [events, locale, i18n])
}

export default useStaticExportLocale
