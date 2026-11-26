import contentEn from '../../../content/verifiedProvider.json'
import contentJa from '../../../content/verifiedProvider.ja.json'
import useLocaleContent from '../../i18n/useLocaleContent'

export type VerifiedProviderContent = typeof contentEn

export function useVerifiedProviderContent(): VerifiedProviderContent {
  return useLocaleContent(contentEn, contentJa)
}

/** Fills `{{name}}` placeholders. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '')
}
