import { ReactElement } from 'react'
import Page from '@shared/Page'
import router from 'next/router'
import Bookmarks from '@components/Home/Bookmarks'
import contentEn from '../../content/pages/bookmarks.json'
import contentJa from '../../content/pages/bookmarks.ja.json'
import useLocaleContent from '../i18n/useLocaleContent'

export default function PageHome(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const { title, description } = content

  return (
    <Page title={title} description={description} uri={router.route}>
      <Bookmarks />
    </Page>
  )
}
