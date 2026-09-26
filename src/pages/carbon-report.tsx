import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import CarbonReport from '@components/CarbonReport'
import useLocaleContent from '../i18n/useLocaleContent'
import contentEn from '../../content/carbonReport.json'
import contentJa from '../../content/carbonReport.ja.json'

export default function PageCarbonReport(): ReactElement {
  const { title, description } = useLocaleContent(contentEn, contentJa)
  const router = useRouter()

  return (
    <Page title={title} description={description} uri={router.route}>
      <CarbonReport />
    </Page>
  )
}
