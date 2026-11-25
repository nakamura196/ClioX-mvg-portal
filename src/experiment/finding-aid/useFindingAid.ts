import findingAidEn from '../../../content/findingAid.json'
import findingAidJa from '../../../content/findingAid.ja.json'
import useLocaleContent from '../../i18n/useLocaleContent'

export type FindingAidContent = typeof findingAidEn

export default function useFindingAid(): FindingAidContent {
  return useLocaleContent(findingAidEn, findingAidJa)
}
