import { useTranslation } from 'react-i18next'

/**
 * Translates the search filter / sort labels, which are defined as plain
 * English strings in module-level constants (and, for custom filters, in
 * `filters.config.js`). Lookup is keyed by the English source string under
 * `search.labels`, and anything without an entry — a project-specific custom
 * filter, say — falls back to the string as written.
 */
export function useSearchLabel(): (label: string) => string {
  const { t } = useTranslation('common')

  return (label: string) =>
    t(`search.labels.${label}`, { defaultValue: label }) as string
}

export default useSearchLabel
