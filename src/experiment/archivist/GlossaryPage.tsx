import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import ArchivistGlossary from './Glossary'
import useArchivistGlossary from './Term/useArchivistGlossary'

export default function PageGlossary(): ReactElement {
  const glossary = useArchivistGlossary()
  const router = useRouter()

  return (
    <Page
      title={glossary.title}
      description={glossary.description}
      uri={router.route}
    >
      <ArchivistGlossary />
    </Page>
  )
}
