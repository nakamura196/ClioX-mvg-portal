import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import CarbonChoice from '@components/CarbonChoice'
import useLocaleContent from '../i18n/useLocaleContent'
import contentEn from '../../content/carbonChoice.json'
import contentJa from '../../content/carbonChoice.ja.json'

export default function PageCarbonChoice(): ReactElement {
  const { title, description } = useLocaleContent(contentEn, contentJa)
  const router = useRouter()

  return (
    <Page title={title} description={description} uri={router.route}>
      <CarbonChoice />
    </Page>
  )
}
