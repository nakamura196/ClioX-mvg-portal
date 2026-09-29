// Records the demo video described in script.json from a running portal.
//
// The captions are drawn by the page itself (an overlay injected before each
// load), so they are burned into the recording without needing ffmpeg's
// subtitle filters. The same timings are written out as WebVTT files, one per
// language, so players can also show them as a selectable track.
//
// Usage: see build.zsh (it installs Playwright and converts to MP4).
//   node record.mjs <baseUrl> <outDir>

import { createRequire } from 'node:module'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  symlinkSync
} from 'node:fs'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(process.env.PLAYWRIGHT_DIR || here, 'x.js'))
const { chromium } = require('playwright')

const [baseUrl = 'http://localhost:8140', outDir = join(here, 'out')] =
  process.argv.slice(2)
const script = JSON.parse(readFileSync(join(here, 'script.json'), 'utf8'))
const { width, height } = script.viewport

// Reading time: about 3 words a second, never shorter than 3 s.
const readingTime = (text) => Math.max(3, text.split(/\s+/).length / 3 + 1.2)

const overlay = () => {
  const css = `
    #demo-cover { position: fixed; inset: 0; z-index: 2147483646;
      background: #2b211c; color: #f6efe9; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 18px; text-align: center;
      font: 400 26px/1.4 system-ui, sans-serif; transition: opacity .6s; }
    #demo-cover h1 { font: 700 60px/1.1 system-ui, sans-serif; margin: 0 0 8px; color: inherit; }
    #demo-cover p { color: inherit; }
    #demo-cover p { margin: 0; opacity: .85; }
    #demo-cover p + p { font-size: 20px; opacity: .7; }
    #demo-cover.gone { opacity: 0; pointer-events: none; }
    #demo-caption { position: fixed; left: 50%; bottom: 36px; z-index: 2147483647;
      transform: translateX(-50%); max-width: 1040px; padding: 12px 22px;
      background: rgba(20, 16, 14, .86); color: #fff; border-radius: 8px;
      font: 500 28px/1.35 system-ui, sans-serif; text-align: center;
      transition: opacity .3s; }
    #demo-caption:empty { opacity: 0; }
    #demo-box { position: absolute; z-index: 2147483645; pointer-events: none;
      border: 4px solid #d9793f; border-radius: 10px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, .28); transition: all .5s; }
    nextjs-portal { display: none !important; }`
  const mount = () => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    const cover = document.createElement('div')
    cover.id = 'demo-cover'
    document.body.appendChild(cover)
    const caption = document.createElement('div')
    caption.id = 'demo-caption'
    document.body.appendChild(caption)
    window.__demo = {
      cover(title, lines) {
        cover.innerHTML = ''
        if (title)
          cover.appendChild(
            Object.assign(document.createElement('h1'), { textContent: title })
          )
        for (const l of lines || [])
          cover.appendChild(
            Object.assign(document.createElement('p'), { textContent: l })
          )
        cover.classList.remove('gone')
      },
      uncover() {
        cover.classList.add('gone')
      },
      caption(text) {
        caption.textContent = text || ''
      },
      box(r) {
        let b = document.getElementById('demo-box')
        if (!r) return b && b.remove()
        if (!b) {
          b = document.createElement('div')
          b.id = 'demo-box'
          document.body.appendChild(b)
        }
        Object.assign(b.style, {
          left: r.x - 10 + 'px',
          top: r.y - 10 + 'px',
          width: r.w + 20 + 'px',
          height: r.h + 20 + 'px'
        })
      }
    }
    cover.classList.add('gone')
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
}

const locate = (page, t) => {
  if (t.role) return page.getByRole(t.role, { name: t.name, exact: !!t.exact })
  if (t.css) return page.locator(t.css)
  return page.getByText(t.text, { exact: !!t.exact })
}

async function highlight(page, targets) {
  const boxes = []
  for (const t of targets) {
    const loc = locate(page, t)
    const n = await loc.count()
    let found = null
    for (let i = 0; i < n && !found; i++) {
      if (await loc.nth(i).isVisible()) found = loc.nth(i)
    }
    if (!found)
      throw new Error(`highlight target not found: ${JSON.stringify(t)}`)
    boxes.push(found)
  }
  // Bring the first target to the middle of the screen, then frame all of them.
  await boxes[0].evaluate((el) =>
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  )
  await page.waitForTimeout(900)
  const rects = []
  for (const b of boxes)
    rects.push(
      await b.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: r.left + scrollX,
          y: r.top + scrollY,
          r: r.right + scrollX,
          b: r.bottom + scrollY
        }
      })
    )
  const u = rects.reduce((a, r) => ({
    x: Math.min(a.x, r.x),
    y: Math.min(a.y, r.y),
    r: Math.max(a.r, r.r),
    b: Math.max(a.b, r.b)
  }))
  await page.evaluate((r) => window.__demo.box(r), {
    x: u.x,
    y: u.y,
    w: u.r - u.x,
    h: u.b - u.y
  })
  await page.waitForTimeout(700) // let the frame finish moving before the caption
}

const exe =
  process.env.CHROMIUM_PATH ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`
const browser = await chromium.launch({ executablePath: exe })
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  locale: 'en-CA'
})
await context.addCookies([
  { name: 'allowExternalContent', value: 'true', url: baseUrl }
])
await context.addInitScript(overlay)
const page = await context.newPage()

// Frames come from the browser's own screencast. Each frame carries the
// wall-clock time it was painted, so captions and cuts line up exactly
// (Playwright's recordVideo drifted by 1–4 s against our clock).
const framesDir = join(outDir, 'frames')
rmSync(framesDir, { recursive: true, force: true })
mkdirSync(framesDir, { recursive: true })
const frames = []
const cdp = await context.newCDPSession(page)
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  const file = join(framesDir, `${String(frames.length).padStart(5, '0')}.jpg`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  frames.push({ t: metadata.timestamp, file })
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 92,
  maxWidth: width,
  maxHeight: height
})
const now = () => Date.now() / 1000
const t0 = now()
const cuts = []
const cues = []

for (const step of script.steps) {
  const cover = () =>
    page.evaluate((c) => {
      if (!window.__demo) return
      window.__demo.box(null)
      window.__demo.caption('')
      window.__demo.cover(c.title, c.lines)
    }, step.cover)
  if (step.cover) {
    await cover().catch(() => {}) // about:blank has no overlay
    await page.waitForTimeout(700)
  }
  if (step.goto) {
    // Loading time is not part of the story: it is cut out below.
    const started = now()
    await page.goto(baseUrl + step.goto.replace('{asset}', script.asset), {
      waitUntil: 'networkidle',
      timeout: 180000
    })
    if (step.cover) await cover()
    await page.waitForTimeout(1500)
    cuts.push([started, now()])
  }
  if (step.hold) await page.waitForTimeout(step.hold * 1000)
  if (step.uncover) {
    await page.evaluate(() => window.__demo.uncover())
    await page.waitForTimeout(700)
  }
  if (step.highlight) await highlight(page, step.highlight)
  let cue
  if (step.en) {
    await page.evaluate((t) => window.__demo.caption(t), step.en)
    cue = { start: now(), en: step.en, ja: step.ja }
    await page.waitForTimeout(readingTime(step.en) * 1000)
  }
  if (step.then?.click) {
    // The caption stays up while the viewer sees what the click did; the
    // wait for the new screen is cut out.
    const started = now()
    await page.evaluate(() => window.__demo.box(null))
    await locate(page, step.then.click).first().click()
    if (step.then.waitText)
      await page
        .getByText(step.then.waitText)
        .first()
        .waitFor({ timeout: 180000 })
    await page.waitForTimeout(800)
    cuts.push([started, now()])
    await page.waitForTimeout((step.then.hold || 0) * 1000)
  }
  if (cue) cues.push({ ...cue, end: now() })
}
await page.evaluate(() => window.__demo.caption(''))
await page.waitForTimeout(500)
const end = now()
await cdp.send('Page.stopScreencast')
await browser.close()

// Everything before the first cover and inside the cuts is dropped; the
// last frame of each cut is kept so the screen is right when play resumes.
cuts.unshift([Math.min(t0, frames[0].t), cuts.length ? cuts[0][0] : t0])
const origin = cuts[0][0]
const shift = (t) =>
  t -
  origin -
  cuts.reduce((s, [a, b]) => s + (t >= b ? b - a : t > a ? t - a : 0), 0)
const kept = []
frames.forEach((f, i) => {
  const cut = cuts.find(([a, b]) => f.t >= a && f.t < b)
  const next = frames[i + 1]
  if (!cut) return kept.push({ ...f, at: shift(f.t) })
  if (!next || next.t >= cut[1]) kept.push({ ...f, at: shift(cut[1]) })
})
// Lay the frames on a fixed 30 fps grid: output frame k shows the last
// screen painted at or before k/30 s. Links, not copies, so it stays cheap.
const fps = 30
const seqDir = join(outDir, 'seq')
rmSync(seqDir, { recursive: true, force: true })
mkdirSync(seqDir)
const slots = Math.round(shift(end) * fps)
for (let k = 0, i = 0; k < slots; k++) {
  while (i + 1 < kept.length && kept[i + 1].at <= k / fps) i++
  symlinkSync(kept[i].file, join(seqDir, `${String(k).padStart(6, '0')}.jpg`))
}

const fmt = (t) => {
  const ms = Math.round(t * 1000)
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0')
  const s = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, '0')}`
}
for (const lang of ['en', 'ja']) {
  const body = cues
    .map(
      (c, i) =>
        `${i + 1}\n${fmt(shift(c.start))} --> ${fmt(shift(c.end))}\n${
          c[lang]
        }\n`
    )
    .join('\n')
  writeFileSync(join(outDir, `captions.${lang}.vtt`), `WEBVTT\n\n${body}`)
}
// The English captions are already in the picture. Both languages are also
// added as selectable tracks, off by default so English is not shown twice.
const mp4 = join(outDir, 'clio-x-first-look.mp4')
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(fps),
    '-i',
    join(seqDir, '%06d.jpg'),
    '-i',
    join(outDir, 'captions.en.vtt'),
    '-i',
    join(outDir, 'captions.ja.vtt'),
    '-map',
    '0:v',
    '-map',
    '1',
    '-map',
    '2',
    '-vf',
    'format=yuv420p',
    '-c:v',
    'libx264',
    '-crf',
    '18',
    '-preset',
    'slow',
    '-c:s',
    'mov_text',
    '-metadata:s:s:0',
    'language=eng',
    '-metadata:s:s:1',
    'language=jpn',
    '-disposition:s:0',
    '0',
    '-disposition:s:1',
    '0',
    '-movflags',
    '+faststart',
    mp4
  ],
  { stdio: 'inherit' }
)
console.log(
  `${frames.length} frames (${kept.length} kept), ${cues.length} captions, ` +
    `video ${shift(end).toFixed(1)} s -> ${mp4}`
)
