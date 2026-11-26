#!/usr/bin/env node
/**
 * Local test double for the "verified by id.ldas.jp" mark and catalogue filter.
 * Serves, with CORS *:
 *   GET  /registry/providers.json                     (the fixture file)
 *   POST /api/aquarius/assets/metadata/query          (Elasticsearch-style hits)
 *   GET  /api/aquarius/assets/ddo/<did>
 * The query handler applies only `terms`/`term` on nft.owner, case-insensitively.
 *
 *   node scripts/dev/mock-catalogue.mjs [port]      (default 8793)
 *   NEXT_PUBLIC_METADATACACHE_URI=http://localhost:8793
 *   NEXT_PUBLIC_METADATACACHE_OCEAN_NODE=true   (default response is Ocean Node style: all
 *   assets, filtered client-side; MOCK_ES=1 gives Elasticsearch style + owner filtering)
 *   NEXT_PUBLIC_LDAS_REGISTRY_URL=http://localhost:8793/registry/providers.json
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.argv[2] || 8793)
const registryFile = path.join(dir, 'fixtures', 'ldas-providers.sample.json')

// 0xedAa… is a real Sepolia publisher address (kept lower-case here on
// purpose: the portal must compare case-insensitively).
const BASE = `http://localhost:${port}`
const VERIFIED = '0xedaa08237554bbafc218f0eaa86704e1ade9262e'
const SELF_DECLARED = '0xc2679fbd37d54388ce493f1db75320d236e1815e'
const UNVERIFIED = '0x1111111111111111111111111111111111111111'

function asset(n, name, owner, type = 'dataset', endpoint = BASE) {
  const id = `did:op:${String(n).padStart(64, '0')}`
  return {
    '@context': ['https://w3id.org/did/v1'],
    id,
    version: '4.1.0',
    chainId: 11155111,
    nftAddress: `0x${String(n).padStart(40, 'a')}`,
    metadata: {
      created: '2026-11-01T00:00:00Z',
      updated: '2026-11-01T00:00:00Z',
      type,
      name,
      description: `${name}: sample record for the verified-mark test.`,
      author: 'Test',
      license: 'CC0-1.0',
      tags: ['sample']
    },
    services: [
      {
        id: `s${n}`,
        type: 'access',
        files: '',
        datatokenAddress: `0x${String(n).padStart(40, 'b')}`,
        serviceEndpoint: endpoint,
        timeout: 0
      }
    ],
    nft: {
      address: `0x${String(n).padStart(40, 'a')}`,
      name: 'Sample',
      symbol: 'S',
      state: 0,
      owner,
      created: '2026-11-01T00:00:00Z'
    },
    datatokens: [
      {
        address: `0x${String(n).padStart(40, 'b')}`,
        name: 'Sample DT',
        symbol: `DT${n}`,
        serviceId: `s${n}`
      }
    ],
    stats: { orders: 0, price: { value: 0, tokenSymbol: 'OCEAN' } },
    purgatory: { state: false }
  }
}

const assets = [
  asset(1, 'Kamakura Documents OCR (verified owner)', VERIFIED),
  asset(2, 'Kotenseki Page Images (verified owner)', VERIFIED),
  asset(3, 'Self-declared Provider Dataset', SELF_DECLARED),
  asset(4, 'Anonymous Upload A (not verified)', UNVERIFIED),
  asset(5, 'Anonymous Upload B (not verified)', UNVERIFIED, 'algorithm'),
  // verified owner, but served from someone's own machine: the portal's
  // node/provider filter must still hide it
  asset(
    6,
    'Verified owner, foreign provider',
    VERIFIED,
    'dataset',
    'http://127.0.0.1:8001'
  )
]

function ownersFromQuery(body) {
  const owners = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    for (const kind of ['terms', 'term']) {
      const v = node[kind]?.['nft.owner']
      if (v !== undefined)
        owners.push([].concat(v).map((x) => String(x).toLowerCase()))
    }
    Object.values(node).forEach(walk)
  }
  walk(body?.query)
  return owners
}

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') return res.writeHead(204).end()
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.url.startsWith('/registry/providers.json')) {
      if (process.env.MOCK_REGISTRY_FAIL === '1') return send(503, {})
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'max-age=300'
      })
      return res.end(fs.readFileSync(registryFile))
    }
    const ddo = req.url.match(/\/api\/aquarius\/assets\/ddo\/(.+)$/)
    if (req.method === 'GET' && ddo) {
      const a = assets.find((x) => x.id === decodeURIComponent(ddo[1]))
      return a ? send(200, a) : send(404, {})
    }
    if (req.method === 'POST' && req.url.includes('/assets/metadata/query')) {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw || '{}')
        const constraints = ownersFromQuery(body)
        const hits = assets.filter((a) =>
          constraints.every((list) => list.includes(a.nft.owner.toLowerCase()))
        )
        if (process.env.MOCK_ES === '1')
          send(200, {
            hits: {
              total: { value: hits.length },
              hits: hits.map((a) => ({ _source: a }))
            }
          })
        else
          send(200, [
            { found: assets.length, hits: assets.map((a) => ({ document: a })) }
          ])
      })
      return
    }
    send(404, { error: 'not found' })
  })
  .listen(port, () => console.log(`mock catalogue on http://localhost:${port}`))
