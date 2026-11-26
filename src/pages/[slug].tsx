import { ReactElement } from 'react'
import { getPageBySlug, getAllPages, PageData } from '@utils/markdownPages'
import Page from '@shared/Page'
import styles from '@shared/Page/PageMarkdown.module.css'
import Container from '@shared/atoms/Container'
import { useRouter } from 'next/router'
import { markdownToHtmlWithToc } from '@utils/markdown'
import useActiveLocale from '../i18n/useActiveLocale' // [local patch]

// [local patch] The static export has no locales, so getStaticProps also ships
// the Japanese page (`<slug>.ja.md`) and the client picks it on /ja/<slug>.
type LocalizedPageData = PageData & {
  ja?: Pick<PageData, 'frontmatter' | 'content'> | null
}

export default function PageMarkdown(
  page: LocalizedPageData
): ReactElement | null {
  const router = useRouter()
  const locale = useActiveLocale() // [local patch]
  if (!page || page.content === '') return null

  const shown = locale === 'ja' && page.ja ? page.ja : page // [local patch]
  const { title, description } = shown.frontmatter
  const { content } = shown

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
  params,
  locale
}: {
  params: { slug: string }
  locale: string
}): Promise<{ props: LocalizedPageData }> {
  const page = getPageBySlug(params.slug, undefined, locale)
  const content = markdownToHtmlWithToc(page?.content || '')

  // [local patch] see LocalizedPageData
  let ja: LocalizedPageData['ja'] = null
  if (!locale) {
    const jaPage = getPageBySlug(params.slug, undefined, 'ja')
    if (jaPage.content !== page.content) {
      ja = {
        frontmatter: jaPage.frontmatter,
        content: markdownToHtmlWithToc(jaPage.content || '')
      }
    }
  }

  return {
    props: { ...page, content, ja }
  }
}

export async function getStaticPaths({
  locales
}: {
  locales?: string[]
}): Promise<{
  paths: {
    params: {
      slug: string
    }
    locale?: string
  }[]
  fallback: boolean
}> {
  const pages = getAllPages()

  if (!locales || locales.length === 0) {
    return {
      paths: pages.map((page) => ({ params: { slug: page.slug } })),
      fallback: false
    }
  }

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
