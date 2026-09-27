// Copies the source documents of this repository into the site before each
// build, so that each text has one place where it is edited:
//
//   docs/self-hosting.md, docs/for-archivists/*, deploy/trial/README.md,
//   docs/api/*.yaml, docs/prototypes/<topic>/
//
// Relative links in those files are rewritten: a link to another synced file
// becomes a link to its page on this site, anything else becomes a link to the
// file on GitHub. The generated files are listed in .gitignore.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(site, '..')
const src = path.join(site, 'src')
const pub = path.join(site, 'src/public')

export const GITHUB =
  'https://github.com/nakamura196/ClioX-mvg-portal/blob/docs/site/'

// repo path → site route (without .md) and output file under src/
const pages = {
  'docs/self-hosting.md': 'developers/self-hosting',
  'deploy/trial/README.md': 'developers/trial-run',
  'docs/for-archivists/when-a-node-closes.md': 'archivists/when-a-node-closes',
  'docs/for-archivists/when-a-node-closes.ja.md':
    'ja/archivists/when-a-node-closes'
}

const topics = fs
  .readdirSync(path.join(repo, 'docs/prototypes'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
for (const t of topics) {
  pages[`docs/prototypes/${t}/README.md`] = `project/prototypes/${t}`
}

const banner = (from) =>
  `<!-- Generated from ${from} by scripts/sync-sources.mjs. Edit the source, not this file. -->\n\n`

function rewriteLinks(text, from, route) {
  const fromDir = path.posix.dirname(from)
  const depth = route.split('/').length - 1
  const up = depth ? '../'.repeat(depth) : './'
  return text.replace(/\]\(([^)\s]+)\)/g, (all, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return all
    const [p, hash = ''] = target.split('#')
    const resolved = path.posix.normalize(path.posix.join(fromDir, p))
    const anchor = hash ? `#${hash}` : ''
    if (pages[resolved]) return `](${up}${pages[resolved]}${anchor})`
    if (resolved === 'docs/api/cliox-sepolia.openapi.yaml')
      return `](${up}developers/api)`
    const isDir =
      fs.existsSync(path.join(repo, resolved)) &&
      fs.statSync(path.join(repo, resolved)).isDirectory()
    const url = GITHUB.replace('/blob/', isDir ? '/tree/' : '/blob/')
    return `](${url}${resolved}${anchor})`
  })
}

function gallery(topic) {
  const dir = path.join(repo, 'docs/prototypes', topic)
  const images = fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g)$/.test(f))
    .sort()
  if (!images.length) return ''
  const items = images
    .map((f) => `![${f}](/prototypes/${topic}/${f})\n\n<small>\`${f}\`</small>`)
    .join('\n\n')
  return `\n\n## Screenshots\n\n${items}\n`
}

for (const [from, route] of Object.entries(pages)) {
  let text = fs.readFileSync(path.join(repo, from), 'utf8')
  text = rewriteLinks(text, from, route)
  const topic = from.match(/^docs\/prototypes\/([^/]+)\//)?.[1]
  if (topic) {
    text += `\n\nSource: [\`docs/prototypes/${topic}/\`](${GITHUB.replace(
      '/blob/',
      '/tree/'
    )}docs/prototypes/${topic})\n`
    text += gallery(topic)
  }
  const out = path.join(src, `${route}.md`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, banner(from) + text)
}

// Static files: prototype screenshots/captions/samples and the OpenAPI file.
fs.rmSync(path.join(pub, 'prototypes'), { recursive: true, force: true })
for (const t of topics) {
  const dir = path.join(repo, 'docs/prototypes', t)
  const dest = path.join(pub, 'prototypes', t)
  fs.mkdirSync(dest, { recursive: true })
  for (const f of fs.readdirSync(dir)) {
    if (/\.(png|jpe?g|vtt|csv|pdf)$/.test(f))
      fs.copyFileSync(path.join(dir, f), path.join(dest, f))
  }
}
fs.mkdirSync(path.join(pub, 'api'), { recursive: true })
fs.copyFileSync(
  path.join(repo, 'docs/api/cliox-sepolia.openapi.yaml'),
  path.join(pub, 'api/cliox-sepolia.openapi.yaml')
)

console.log(
  `synced ${Object.keys(pages).length} pages, ${topics.length} prototypes`
)
