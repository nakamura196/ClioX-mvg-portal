import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import SampleCollection from '@components/SampleCollection'
import useLocaleContent from '../i18n/useLocaleContent'
import contentEn from '../../content/sampleCollection.json'
import contentJa from '../../content/sampleCollection.ja.json'

export default function PageSampleCollection(): ReactElement {
  const { title, description } = useLocaleContent(contentEn, contentJa)
  const router = useRouter()

  return (
    <Page title={title} description={description} uri={router.route}>
      <SampleCollection />
    </Page>
  )
}
