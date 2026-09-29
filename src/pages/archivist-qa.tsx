import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import ArchivistQa from '@components/ArchivistQa'
import useLocaleContent from '../i18n/useLocaleContent'
import contentEn from '../../content/archivistQa/ui.json'
import contentJa from '../../content/archivistQa/ui.ja.json'

export default function PageArchivistQa(): ReactElement {
  const { title, description } = useLocaleContent(contentEn, contentJa)
  const router = useRouter()

  return (
    <Page title={title} description={description} uri={router.route}>
      <ArchivistQa />
    </Page>
  )
}
