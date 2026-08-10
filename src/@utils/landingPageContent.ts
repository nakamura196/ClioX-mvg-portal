import { useRouter } from 'next/router'
import { useMemo } from 'react'
import homeLandingPage from '../../content/pages/home/landing-page.json'
import homeLandingPageJa from '../../content/pages/home/landing-page.ja.json'
import mergeLocaleContent from '../i18n/mergeLocaleContent'

/**
 * Landing page copy for the active locale. The `.ja.json` file only
 * carries the translated strings; images, links and anything left untranslated
 * fall through to the English content. See `mergeLocaleContent` for the merge
 * rules (arrays merge by index).
 */
export const useLandingPageContent = (): typeof homeLandingPage => {
  const { locale } = useRouter()

  return useMemo(
    () =>
      locale === 'ja'
        ? mergeLocaleContent(homeLandingPage, homeLandingPageJa)
        : homeLandingPage,
    [locale]
  )
}
