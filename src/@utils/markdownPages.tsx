import fs from 'fs'
import { join } from 'path'
import matter from 'gray-matter'

//
// Next.js specifics to be used in getStaticProps / getStaticPaths
// to automatically generate pages from Markdown files in `src/pages/[slug].tsx`.
//
// const pagesDirectory = join(process.cwd(), 'content', 'pages')
const pagesDirectory = './content/pages'
export interface PageData {
  slug: string
  frontmatter: { [key: string]: any }
  content: string
}

// Matches a translated sibling of a page, e.g. `imprint.ja.md` next to
// `imprint.md`. Pages whose slug *is* the language (content/pages/privacy/en.md)
// have no dot before the language tag and are deliberately not matched.
const translatedFile = /\.[a-z]{2}\.md$/

export function getPageBySlug(
  slug: string,
  subDir?: string,
  locale?: string
): PageData {
  const realSlug = slug.replace(/\.md$/, '')
  const dir = subDir ? join(pagesDirectory, subDir) : pagesDirectory

  // Prefer `<slug>.<locale>.md` when it exists, fall back to the English page.
  const localizedPath = locale && join(dir, `${realSlug}.${locale}.md`)
  const fullPath =
    localizedPath && fs.existsSync(localizedPath)
      ? localizedPath
      : join(dir, `${realSlug}.md`)

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  return { slug: realSlug, frontmatter: { ...data }, content }
}

export function getAllPages(subDir?: string): PageData[] {
  const slugs = fs
    .readdirSync(join(pagesDirectory, subDir || ''))
    .filter((slug) => slug.includes('.md'))
    // Translations are served through the locale of an existing page, so they
    // must not become routes of their own (`/imprint.ja`).
    .filter((slug) => !translatedFile.test(slug))
  const pages = slugs.map((slug) => getPageBySlug(slug, subDir))

  return pages
}
