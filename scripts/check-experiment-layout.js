#!/usr/bin/env node
/* eslint-disable no-console */
// Keeps this fork's own code separate from upstream ciferresearch/ClioX-mvg-portal.
// Rules (see CLAUDE.md, "Where our code goes"):
//  1. A file under src/ that upstream does not have must live in
//     src/experiment/ or src/pages/experiment/, or be listed in
//     scripts/local-patches.txt (fixes to the portal itself).
//  2. Listed .ts/.tsx/.js files carry a "[local patch]" comment.
//  3. Outside src/experiment/, prototype code is imported only through the
//     @experiment/ alias, and each such import is marked "[prototype]" on the
//     import line or the line above it.
//  4. Files in src/pages/experiment/ only re-export a page from src/experiment/.
// Upstream is UPSTREAM_REF (default origin/main). If that ref is missing,
// rules 1 and 2 are skipped with a notice; 3 and 4 always run.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const UPSTREAM_REF = process.env.UPSTREAM_REF || 'origin/main'
const git = (cmd) =>
  execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })

const errors = []
const isPrototypePath = (f) =>
  f.startsWith('src/experiment/') || f.startsWith('src/pages/experiment/')

const allowlist = fs
  .readFileSync(path.join(ROOT, 'scripts/local-patches.txt'), 'utf8')
  .split('\n')
  .map((l) => l.replace(/#.*/, '').trim())
  .filter(Boolean)
const allowed = (f) =>
  allowlist.some((a) => (a.endsWith('/') ? f.startsWith(a) : f === a))

const tracked = git('ls-files --cached --others --exclude-standard src')
  .split('\n')
  .filter(Boolean)
  .filter((f) => fs.existsSync(path.join(ROOT, f)))

// Rules 1 and 2
let base = null
try {
  base = git(`merge-base ${UPSTREAM_REF} HEAD`).trim()
} catch (e) {
  console.log(
    `check-experiment-layout: ${UPSTREAM_REF} not found, skipping the added-files rule`
  )
}
if (base) {
  const upstream = new Set(
    git(`ls-tree -r --name-only ${base} src`).split('\n').filter(Boolean)
  )
  for (const f of tracked) {
    if (upstream.has(f) || isPrototypePath(f)) continue
    if (!allowed(f)) {
      errors.push(
        `${f}: new file outside src/experiment/. Move it to src/experiment/<feature>/, or list it in scripts/local-patches.txt if it fixes the portal itself.`
      )
    } else if (
      /\.(ts|tsx|js)$/.test(f) &&
      !fs.readFileSync(path.join(ROOT, f), 'utf8').includes('[local patch]')
    ) {
      errors.push(
        `${f}: listed as a local patch but has no "[local patch]" comment.`
      )
    }
  }
}

// Rule 3
const IMPORT_RE =
  /(?:from|import|require|jest\.mock)\s*\(?\s*['"]([^'"\n]+)['"]/g
for (const f of tracked) {
  if (!/\.(ts|tsx|js|jsx)$/.test(f) || f.startsWith('src/experiment/')) continue
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8')
  const lines = text.split('\n')
  let m
  while ((m = IMPORT_RE.exec(text))) {
    const spec = m[1]
    const lineNo = text.slice(0, m.index).split('\n').length - 1
    if (spec.startsWith('.')) {
      const target = path.normalize(path.join(path.dirname(f), spec))
      if (target.startsWith('src/experiment/') || target === 'src/experiment') {
        errors.push(
          `${f}:${
            lineNo + 1
          }: import prototype code through @experiment/, not a relative path.`
        )
      }
      continue
    }
    if (!spec.startsWith('@experiment/')) continue
    if (f.startsWith('src/pages/experiment/')) continue
    // find the first line of the statement
    let start = lineNo
    while (start > 0 && !/^\s*(import|export)\b/.test(lines[start])) start--
    const window = [lines[start - 1] || '', ...lines.slice(start, lineNo + 1)]
    if (!window.some((l) => l.includes('[prototype]'))) {
      errors.push(
        `${f}:${
          lineNo + 1
        }: import of ${spec} needs a "[prototype]" comment on the import or the line above.`
      )
    }
  }
}

// Rule 4
const REEXPORT_RE =
  /^(export\s*\{[^}]*\}\s*from\s*'@experiment\/[^']+'\s*;?\s*)+$/
for (const f of tracked.filter((t) => t.startsWith('src/pages/experiment/'))) {
  const code = fs
    .readFileSync(path.join(ROOT, f), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
    .trim()
  if (!REEXPORT_RE.test(code)) {
    errors.push(
      `${f}: pages under src/pages/experiment/ only re-export from @experiment/ (put the page in src/experiment/<feature>/).`
    )
  }
}

if (errors.length) {
  console.error(`check-experiment-layout: ${errors.length} problem(s)`)
  for (const e of errors) console.error('  ' + e)
  console.error('See CLAUDE.md, "Where our code goes".')
  process.exit(1)
}
console.log('check-experiment-layout: ok')
