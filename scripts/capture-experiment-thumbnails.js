#!/usr/bin/env node
/* eslint-disable no-console */
// Takes the thumbnails shown on /experiment (src/experiment/shell/IndexPage.tsx).
// One screenshot per prototype (1024 px wide, below the site header), saved as
// public/images/experiment/<slug>.jpg.
//
//   node scripts/capture-experiment-thumbnails.js [base-url]
//
// base-url defaults to https://cliox.ldas.jp. Playwright is not a
// dependency of the portal; point NODE_PATH at any node_modules that has it.

const path = require('path')
const { chromium } = require('playwright')

const BASE = (process.argv[2] || 'https://cliox.ldas.jp').replace(/\/$/, '')
const OUT = path.resolve(__dirname, '../public/images/experiment')

// slug → path. Keep in step with ITEMS in IndexPage.tsx.
const SHOTS = {
  'two-condition': '/experiment/two-condition?view=receipt&sample=t4a&steps=1',
  'carbon-report': '/experiment/carbon-report',
  'carbon-choice': '/experiment/carbon-choice',
  'sample-collection': '/experiment/sample-collection',
  'archivist-qa': '/experiment/archivist-qa',
  'finding-aid':
    '/experiment/finding-aid/did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c',
  glossary: '/experiment/glossary',
  'asset-demo':
    '/asset/did:op:04f79245ba012ab323600b60bb537c865560ca18867025a3d31b38f4560b9787?demo=1&env=a'
}

// Fig. 1 lives in the comparison table further down the asset page.
const SCROLL_TO = { 'asset-demo': 'input[name="demo-compare"]' }
// pages with a step strip under the header start lower
const TOP = { 'two-condition': 150 }
// ONLY=slug,slug retakes just those
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

;(async () => {
  require('fs').mkdirSync(OUT, { recursive: true })
  // PW_CHANNEL=chrome uses the installed Chrome when the bundled one is missing
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL })
  for (const [slug, p] of Object.entries(SHOTS)) {
    if (ONLY && !ONLY.includes(slug)) continue
    const page = await browser.newPage({
      viewport: { width: 1024, height: 900 },
      locale: 'en'
    })
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 120000 })
    // the app shell renders client-side; wait for the page's own heading
    await page.waitForSelector('main h1, main h2', { timeout: 60000 })
    await page.waitForTimeout(3000)
    await page.evaluate(() =>
      document.querySelectorAll('nextjs-portal').forEach((e) => e.remove())
    )
    let top = TOP[slug] || 110 // below the banner and the header
    if (SCROLL_TO[slug]) {
      const el = page.locator(SCROLL_TO[slug]).first()
      const box = await el.evaluate((n) => {
        const r = n.closest('section').getBoundingClientRect()
        return r.top + window.scrollY - 16
      })
      top = Math.max(0, box)
    }
    await page.screenshot({
      path: path.join(OUT, `${slug}.jpg`),
      type: 'jpeg',
      quality: 70,
      fullPage: true,
      clip: { x: 0, y: top, width: 1024, height: 576 }
    })
    console.log(`${slug}: ok`)
    await page.close()
  }
  await browser.close()
})()
