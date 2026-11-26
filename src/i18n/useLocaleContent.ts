// [local patch] Japanese / English interface (react-i18next). Not in upstream; see scripts/local-patches.txt.
import { useMemo } from 'react'
import mergeLocaleContent from './mergeLocaleContent'
import useActiveLocale from './useActiveLocale'

/**
 * Picks the locale variant of a `content/*.json` file.
 *
 * Pass the English content and its `.ja.json` override; the override only needs
 * the strings that actually change, everything else falls through to English.
 *
 *   import content from '../../content/pages/verify.json'
 *   import contentJa from '../../content/pages/verify.ja.json'
 *   ...
 *   const { title, description } = useLocaleContent(content, contentJa)
 *
 * For content read outside a React component, use `mergeLocaleContent`
 * directly with a locale you already have in hand.
 */
export function useLocaleContent<T>(base: T, ja: unknown): T {
  const locale = useActiveLocale()

  return useMemo(
    () => (locale === 'ja' ? mergeLocaleContent(base, ja) : base),
    [locale, base, ja]
  )
}

export default useLocaleContent
