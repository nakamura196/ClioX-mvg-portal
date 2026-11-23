#!/usr/bin/env node
/**
 * Builds a static export (`out/`) for Cloudflare Workers + Assets while
 * keeping local `next dev` / Vercel API routes intact in git.
 *
 * Next.js `output: 'export'` forbids `src/pages/api/*` and pages using
 * `getServerSideProps` (`robots.txt.tsx`, `sitemap.xml.tsx`). Those endpoints
 * are served by `worker/index.ts` on Cloudflare, so this script temporarily
 * moves them outside `src/pages` during the export build and always restores
 * them in `finally`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const stashDir = path.join(root, '.cf-build-stash')
const targets = [
  'src/pages/api',
  'src/pages/robots.txt.tsx',
  'src/pages/sitemap.xml.tsx'
]

function moveIn() {
  if (fs.existsSync(stashDir)) {
    throw new Error(
      `.cf-build-stash already exists; please inspect and remove it first.`
    )
  }
  fs.mkdirSync(stashDir, { recursive: true })
  for (const rel of targets) {
    const src = path.join(root, rel)
    if (fs.existsSync(src)) {
      const dst = path.join(stashDir, path.basename(rel))
      fs.renameSync(src, dst)
    }
  }
}

function restore() {
  if (!fs.existsSync(stashDir)) return
  for (const rel of targets) {
    const dst = path.join(stashDir, path.basename(rel))
    const src = path.join(root, rel)
    if (fs.existsSync(dst)) {
      fs.renameSync(dst, src)
    }
  }
  fs.rmSync(stashDir, { recursive: true, force: true })
}

try {
  moveIn()
  const cmd =
    process.env.SKIP_PREGENERATE === '1'
      ? 'npx next build'
      : 'npm run pregenerate && npx next build'
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_STATIC_EXPORT: 'true',
      NEXT_PUBLIC_METADATACACHE_URI:
        process.env.NEXT_PUBLIC_METADATACACHE_URI ||
        'https://cliox-node.ldas.jp'
    }
  })
} finally {
  restore()
}
