/**
 * Archivist Q&A: picks a prepared answer for a free-text question.
 *
 * Nothing is generated. The question is matched (BM25) against prepared
 * questions in `content/archivistQa/qa(.ja).json` and against the InterPARES
 * Trust AI terminology already bundled for the Resources page. The answer shown
 * is the prepared text itself, so every sentence on screen can be traced to a
 * file in this repository.
 *
 * `toKnowledgeChunks` exports the same text in the chunk format the existing
 * RAG chatbot backend accepts (`@utils/chatbot`), so the corpus can be loaded
 * there unchanged once a backend is available.
 */

export interface QaEntry {
  id: string
  question: string
  keywords: string[]
  answer: string
  related: string[]
  interpares: string[]
}

export interface QaCorpus {
  status: string
  // Japanese names for InterPARES terms, used only for matching. The
  // definitions themselves are shown in the English original.
  interparesAliases?: Record<string, string[]>
  entries: QaEntry[]
}

interface InterparesOtherDefinition {
  text: string
  source_label?: string
  source_url?: string
}

export interface InterparesTerm {
  id: string
  url: string
  labels: { text: string; preferred?: boolean }[]
  interpares_definition: string | null
  other_definitions?: InterparesOtherDefinition[]
  redirect_to?: string | null
}

export interface InterparesQuote {
  id: string
  label: string
  url: string
  // true when InterPARES itself has a definition; false when it says
  // "not yet developed" and we quote the first cited outside definition.
  hasOwnDefinition: boolean
  text: string
  sourceLabel?: string
}

export type QaMatch =
  | { kind: 'entry'; entry: QaEntry; score: number; confident: boolean }
  | { kind: 'term'; term: InterparesQuote; score: number }
  | { kind: 'none'; suggestions: QaEntry[] }

const NO_DEFINITION = /^No definition in earlier IP projects/i

const STOPWORDS = new Set(
  'a an and are as at be by can could do does for from how i if in is it its me my of on or should the this to was we what when where which who why will with you your'.split(
    ' '
  )
)

// Question endings that every prepared question shares (〜とは何ですか).
const JA_STOP = new Set(
  '何 とは は何 何で です すか ます ませ せん して した たら いい くだ ださ さい でき きま れま りま には では ので よう うな なも もの'.split(
    ' '
  )
)

const KANJI = /[\u3400-\u9fff\uf900-\ufaff]/
const HIRAGANA = /[\u3040-\u309f]/

// Just enough stemming to match "records" with "record", "deleted" with "delete".
function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 3 && w.endsWith('ed')) return w.slice(0, -1)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss'))
    return w.slice(0, -1)
  return w
}

/** Latin words plus Japanese character bigrams (no dictionary needed). */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  const lower = (text || '').toLowerCase().normalize('NFKC')
  for (const word of lower.match(/[a-z0-9][a-z0-9:-]*/g) || []) {
    const w = word.replace(/[-:]+$/, '')
    if (w.length > 1 && !STOPWORDS.has(w)) tokens.push(stem(w))
  }
  const runs = lower.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]+/g) || []
  for (const run of runs) {
    // A kanji followed by hiragana is usually a verb or adjective stem
    // (壊して, 払う) and carries meaning on its own. Other single kanji are
    // left out: 気 in 天気 should not match 気候.
    for (let i = 0; i < run.length; i++) {
      const next = run[i + 1]
      if (
        KANJI.test(run[i]) &&
        (run.length === 1 || (next && HIRAGANA.test(next)))
      )
        tokens.push(run[i])
    }
    for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2))
  }
  return tokens.filter((t) => !JA_STOP.has(t))
}

// Calibrated on the sample questions in index.test.ts.
const MIN_SCORE = 2.5
const CONFIDENT_SCORE = 6
const ENTRY_OVER_TERM = 0.6

export function quoteTerm(
  term: InterparesTerm | undefined
): InterparesQuote | undefined {
  if (!term) return undefined
  const label =
    term.labels.find((l) => l.preferred)?.text || term.labels[0]?.text
  const own =
    Boolean(term.interpares_definition) &&
    !NO_DEFINITION.test(term.interpares_definition)
  if (own) {
    return {
      id: term.id,
      label,
      url: term.url,
      hasOwnDefinition: true,
      text: term.interpares_definition as string
    }
  }
  const other = term.other_definitions?.[0]
  return {
    id: term.id,
    label,
    url: term.url,
    hasOwnDefinition: false,
    text: other?.text || '',
    sourceLabel: other?.source_label
  }
}

interface Doc {
  ref: { kind: 'entry'; entry: QaEntry } | { kind: 'term'; id: string }
  tf: Map<string, number>
  length: number
}

function weighted(fields: [string, number][]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const [text, weight] of fields) {
    for (const t of tokenize(text)) tf.set(t, (tf.get(t) || 0) + weight)
  }
  return tf
}

export class QaIndex {
  private docs: Doc[] = []
  private df = new Map<string, number>()
  private avgLength = 1
  private entries = new Map<string, QaEntry>()

  constructor(
    private corpus: QaCorpus,
    private terms: Record<string, InterparesTerm>,
    { includeTerms = true }: { includeTerms?: boolean } = {}
  ) {
    for (const entry of corpus.entries) {
      this.entries.set(entry.id, entry)
      this.add(
        { kind: 'entry', entry },
        weighted([
          [entry.question, 3],
          [entry.keywords.join(' '), 3],
          [entry.answer, 1]
        ])
      )
    }
    // InterPARES labels and definitions are English only. For other
    // languages only the terms with aliases in the corpus are searchable.
    for (const term of Object.values(terms)) {
      if (term.redirect_to) continue
      const aliases = corpus.interparesAliases?.[term.id]
      if (includeTerms) {
        this.add(
          { kind: 'term', id: term.id },
          weighted([
            [term.labels.map((l) => l.text).join(' '), 4],
            [term.interpares_definition, 1]
          ])
        )
      } else if (aliases) {
        this.add(
          { kind: 'term', id: term.id },
          weighted([[aliases.join(' '), 4]])
        )
      }
    }
    const total = this.docs.reduce((n, d) => n + d.length, 0)
    this.avgLength = total / Math.max(this.docs.length, 1)
  }

  private add(ref: Doc['ref'], tf: Map<string, number>) {
    let length = 0
    tf.forEach((v, t) => {
      length += v
      this.df.set(t, (this.df.get(t) || 0) + 1)
    })
    this.docs.push({ ref, tf, length })
  }

  private rank(query: string) {
    const k1 = 1.2
    const b = 0.75
    const n = this.docs.length
    const qTokens = Array.from(new Set(tokenize(query)))
    return this.docs
      .map((doc) => {
        let score = 0
        for (const t of qTokens) {
          const f = doc.tf.get(t)
          if (!f) continue
          const df = this.df.get(t) || 0
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
          score +=
            (idf * f * (k1 + 1)) /
            (f + k1 * (1 - b + (b * doc.length) / this.avgLength))
        }
        return { doc, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
  }

  entry(id: string): QaEntry | undefined {
    return this.entries.get(id)
  }

  quote(id: string): InterparesQuote | undefined {
    return quoteTerm(this.terms[id])
  }

  match(query: string): QaMatch {
    const ranked = this.rank(query)
    const top = ranked[0]
    const firstEntry = ranked.find((r) => r.doc.ref.kind === 'entry')
    const suggestions = ranked
      .filter((r) => r.doc.ref.kind === 'entry')
      .slice(0, 3)
      .map((r) => (r.doc.ref as { entry: QaEntry }).entry)

    if (!top || top.score < MIN_SCORE) {
      return {
        kind: 'none',
        suggestions: suggestions.length
          ? suggestions
          : this.corpus.entries.slice(0, 3)
      }
    }

    // A prepared answer wins unless an InterPARES term is clearly closer
    // (for example "what is provenance?").
    if (
      firstEntry &&
      (top.doc.ref.kind === 'entry' ||
        firstEntry.score >= top.score * ENTRY_OVER_TERM)
    ) {
      const { entry } = firstEntry.doc.ref as { entry: QaEntry }
      return {
        kind: 'entry',
        entry,
        score: firstEntry.score,
        confident: firstEntry.score >= CONFIDENT_SCORE
      }
    }

    const { id } = top.doc.ref as { id: string }
    const term = quoteTerm(this.terms[id])
    if (term) return { kind: 'term', term, score: top.score }
    return { kind: 'none', suggestions }
  }
}

/** The corpus in the chunk format of the existing RAG chatbot backend. */
export function toKnowledgeChunks(corpus: QaCorpus, lang: 'en' | 'ja') {
  return corpus.entries.map((e) => ({
    id: `archivist-qa:${lang}:${e.id}`,
    content: `${e.question}\n\n${e.answer}`,
    metadata: {
      source: `Clio-X archivist Q&A (${lang}, draft)`,
      topic: e.id,
      category: 'archivist-onboarding',
      tags: e.keywords,
      entities: e.interpares
    }
  }))
}
