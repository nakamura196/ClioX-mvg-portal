import { ReactElement, useEffect } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import contentEn from '../../../content/pages/textAnalysis.json'
import contentJa from '../../../content/pages/textAnalysis.ja.json'
import useLocaleContent from '../../i18n/useLocaleContent'
import TextAnalysis from '../../components/TextAnalysis'
import { useUseCases } from '../../@context/UseCases'

export default function TextAnalysisPage(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const router = useRouter()
  const { clearTextAnalysis } = useUseCases()

  const { title, description } = content

  // Clear IndexedDB data when leaving the page
  useEffect(() => {
    return () => {
      const shouldClearOnUnmount =
        process.env.NEXT_PUBLIC_CLEAR_ON_UNMOUNT !== 'false'

      if (shouldClearOnUnmount) {
        clearTextAnalysis()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page title={title} description={description} uri={router.route}>
      <TextAnalysis />
    </Page>
  )
}
