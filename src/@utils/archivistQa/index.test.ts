import { InterparesTerm, QaIndex, tokenize, toKnowledgeChunks } from '.'
import qaEn from '../../../content/archivistQa/qa.json'
import qaJa from '../../../content/archivistQa/qa.ja.json'
import terminology from '../../../content/resources/glossary/terminology.v1.json'

const terms = terminology.termsById as unknown as Record<string, InterparesTerm>
const en = new QaIndex(qaEn, terms)
const ja = new QaIndex(qaJa, terms, { includeTerms: false })

// [question, expected entry id, or "term:<id>", or "none"]
const EN: [string, string][] = [
  ['Where should I begin? I am not an IT person', 'start'],
  ['Will I break anything if I click?', 'break'],
  ['Do I have to install MetaMask?', 'wallet-needed'],
  ['Is it free?', 'cost'],
  ['Is this about bitcoin and speculation?', 'crypto'],
  ['Does blockchain prove a record is authentic?', 'authenticity'],
  ['What does did:op mean?', 'what-is-did'],
  ['Who is the owner of an asset?', 'who-owns'],
  ['Do my files get uploaded somewhere?', 'leave-institution'],
  [
    'How can someone analyse restricted records without getting them?',
    'what-is-c2d'
  ],
  ['Can I remove an asset I published by mistake?', 'delete'],
  ['Can people see which datasets I accessed?', 'who-sees'],
  ['What is Sepolia?', 'what-is-network'],
  ['What is provenance?', 'term:provenance'],
  ['Define fonds', 'term:fonds'],
  ['What is the weather tomorrow?', 'none']
]

const JA: [string, string][] = [
  ['何から始めたらいいですか', 'start'],
  ['クリックして壊したらどうしよう', 'break'],
  ['ウォレットって必要？', 'wallet-needed'],
  ['費用はかかりますか', 'cost'],
  ['仮想通貨の投機ですか', 'crypto'],
  ['ブロックチェーンで真正性は保証されますか', 'authenticity'],
  ['DIDは請求記号のようなもの？', 'what-is-did'],
  ['所有者とデータ作成者の違いは', 'who-owns'],
  ['資料は機関の外に出ますか', 'leave-institution'],
  ['公開した資産を削除できますか', 'delete'],
  ['個人情報を書いてもいいですか', 'personal-data'],
  ['誰が利用したか見えますか', 'who-sees'],
  ['データトークンとは', 'what-is-datatoken'],
  ['来歴とは何ですか', 'term:provenance'],
  ['フォンドとは', 'term:fonds'],
  ['明日の天気は', 'none']
]

function label(index: QaIndex, q: string): string {
  const m = index.match(q)
  if (m.kind === 'entry') return m.entry.id
  if (m.kind === 'term') return `term:${m.term.id}`
  return 'none'
}

describe('archivistQa', () => {
  test.each(EN)('en: %s', (q, expected) => {
    expect(label(en, q)).toBe(expected)
  })
  test.each(JA)('ja: %s', (q, expected) => {
    expect(label(ja, q)).toBe(expected)
  })

  test('both languages have the same entries and valid links', () => {
    expect(qaJa.entries.map((e) => e.id)).toEqual(qaEn.entries.map((e) => e.id))
    const ids = new Set(qaEn.entries.map((e) => e.id))
    let checked = 0
    for (const corpus of [qaEn, qaJa]) {
      for (const e of corpus.entries) {
        for (const r of e.related) {
          expect(ids.has(r)).toBe(true)
          checked++
        }
        for (const t of e.interpares) {
          expect(en.quote(t)?.text).toBeTruthy()
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(50)
  })

  test('tokenize splits Japanese into kanji and bigrams', () => {
    expect(tokenize('壊す')).toEqual(['壊', '壊す'])
    expect(tokenize('Records deleted')).toEqual(['record', 'delete'])
  })

  test('chunks use the existing chatbot format', () => {
    const chunks = toKnowledgeChunks(qaEn, 'en')
    expect(chunks).toHaveLength(qaEn.entries.length)
    expect(chunks[0].metadata.source).toContain('draft')
  })
})
