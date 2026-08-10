import { ReactElement } from 'react'
import { getPageBySlug, getAllPages, PageData } from '@utils/markdownPages'
import Page from '@shared/Page'
import styles from '@shared/Page/PageMarkdown.module.css'
import Container from '@shared/atoms/Container'
import { useRouter } from 'next/router'
import { markdownToHtmlWithToc } from '@utils/markdown'

export default function PageMarkdown(page: PageData): ReactElement | null {
  const router = useRouter()
  if (!page || page.content === '') return null

  const { title, description } = page.frontmatter
  const { content } = page

  return (
    <Page
      title={title}
      description={description}
      uri={router.asPath}
      headerCenter
    >
      <Container narrow>
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </Container>
    </Page>
  )
}

export async function getStaticProps({
  params
}: {
  params: { slug: string }
}): Promise<{ props: PageData }> {
  const page = getPageBySlug(params.slug)
  const content = markdownToHtmlWithToc(page?.content || '')

  return {
    props: { ...page, content }
  }
}

export async function getStaticPaths({
  locales
}: {
  locales: string[]
}): Promise<{
  paths: {
    params: {
      slug: string
    }
    locale: string
  }[]
  fallback: boolean
}> {
  const pages = getAllPages()

  // With locale routing enabled, emit every markdown page once per locale.
  // Without the explicit `locale`, only the default locale gets prerendered and
  // the /ja/... variants 404 in a production build.
  return {
    paths: pages.flatMap((page) =>
      locales.map((locale) => ({ params: { slug: page.slug }, locale }))
    ),
    fallback: false
  }
}
