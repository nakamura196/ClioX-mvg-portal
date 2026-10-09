import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import Experiment from '@components/Experiment'
import useLocaleContent from '../i18n/useLocaleContent'
import contentEn from '../../content/experiment.json'
import contentJa from '../../content/experiment.ja.json'

export default function PageExperiment(): ReactElement {
  const { title, description } = useLocaleContent(contentEn, contentJa)
  const router = useRouter()

  return (
    <Page title={title} description={description} uri={router.route}>
      <Experiment />
    </Page>
  )
}
