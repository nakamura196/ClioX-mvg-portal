import { ReactElement } from 'react'
import Publish from '../../components/Publish'
import Page from '@shared/Page'
import contentEn from '../../../content/publish/index.json'
import contentJa from '../../../content/publish/index.ja.json'
import useLocaleContent from '../../i18n/useLocaleContent'
import router from 'next/router'

export default function PagePublish(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const { title, description } = content

  return (
    <Page
      title={title}
      description={description}
      uri={router.route}
      noPageHeader
    >
      <Publish content={content} />
    </Page>
  )
}
