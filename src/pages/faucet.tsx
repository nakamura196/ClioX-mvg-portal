import { ReactElement } from 'react'
import Faucet from '../components/Faucet'
import contentEn from '../../content/pages/faucet.json'
import contentJa from '../../content/pages/faucet.ja.json'
import useLocaleContent from '../i18n/useLocaleContent'
import Page from '@components/@shared/Page'

export default function PageFaucet(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  return (
    <Page title={content.title} description={content.description} uri="">
      <Faucet />
    </Page>
  )
}
