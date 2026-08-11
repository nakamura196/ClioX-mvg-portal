import { ReactElement, useEffect } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import contentEn from '../../../content/pages/cameroonGazette.json'
import contentJa from '../../../content/pages/cameroonGazette.ja.json'
import useLocaleContent from '../../i18n/useLocaleContent'
import CameroonGazette from '../../components/CameroonGazette'
import { useUseCases } from '../../@context/UseCases'

export default function CameroonGazettePage(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const router = useRouter()
  const { clearCameroonGazette } = useUseCases()

  const { title, description } = content

  // Clear IndexedDB data when leaving the page
  useEffect(() => {
    return () => {
      const shouldClearOnUnmount =
        process.env.NEXT_PUBLIC_CLEAR_ON_UNMOUNT !== 'false'

      if (shouldClearOnUnmount) {
        clearCameroonGazette()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page title={title} description={description} uri={router.route}>
      <CameroonGazette />
    </Page>
  )
}
