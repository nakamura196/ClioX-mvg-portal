import {
  FormEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Markdown from '@shared/Markdown'
import useLocaleContent from '../../i18n/useLocaleContent'
import {
  InterparesQuote,
  InterparesTerm,
  QaCorpus,
  QaEntry,
  QaIndex,
  QaMatch,
  toKnowledgeChunks
} from '@utils/archivistQa'
import uiEn from '../../../content/archivistQa/ui.json'
import uiJa from '../../../content/archivistQa/ui.ja.json'
import qaEn from '../../../content/archivistQa/qa.json'
import qaJa from '../../../content/archivistQa/qa.ja.json'

type Ui = typeof uiEn

interface Turn {
  id: number
  question: string
  match: QaMatch
}

const chip =
  'inline-flex items-center text-left rounded-full border border-[#d0d2dd] bg-white px-3 py-1.5 text-sm text-[#0d0d0d] hover:border-[#6b7280] hover:bg-[#f3f4f6] transition-colors cursor-pointer'

function Chips({
  entries,
  onAsk
}: {
  entries: QaEntry[]
  onAsk: (e: QaEntry) => void
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((e) => (
        <button
          key={e.id}
          type="button"
          className={chip}
          onClick={() => onAsk(e)}
        >
          {e.question}
        </button>
      ))}
    </div>
  )
}

function Quote({ quote, ui }: { quote: InterparesQuote; ui: Ui }) {
  return (
    <div className="border-l-4 border-[#9ca3af] bg-[#f9fafb] px-4 py-3 rounded-r-lg">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
        <strong className="text-[15px]">{quote.label}</strong>
        <span className="text-xs text-[#6b7280]">
          {quote.hasOwnDefinition ? ui.interparesOwn : ui.interparesNone}
        </span>
      </div>
      {/* The InterPARES text is English only and is shown as is. */}
      <p lang="en" className="text-[15px] leading-relaxed m-0">
        {quote.text}
        {quote.sourceLabel && (
          <span className="text-[#6b7280]"> ({quote.sourceLabel})</span>
        )}
      </p>
      <div className="flex gap-4 mt-2 text-sm">
        <Link
          href={`/resources?tab=glossary&term=${encodeURIComponent(quote.id)}`}
          className="underline"
        >
          {ui.openInGlossary}
        </Link>
        <a
          href={quote.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {ui.openOriginal} ↗
        </a>
      </div>
    </div>
  )
}

function Sources({
  ui,
  guide,
  interpares
}: {
  ui: Ui
  guide: boolean
  interpares: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[#374151]">
      <span className="font-semibold">{ui.sources}:</span>
      {guide && (
        <span className="rounded bg-[#fef3c7] px-2 py-0.5">
          {ui.sourceGuide} ({ui.sourceGuideNote})
        </span>
      )}
      {interpares && (
        <span className="rounded bg-[#e0e7ff] px-2 py-0.5">
          {ui.sourceInterpares}
        </span>
      )}
    </div>
  )
}

function Answer({
  match,
  index,
  ui,
  onAsk
}: {
  match: QaMatch
  index: QaIndex
  ui: Ui
  onAsk: (e: QaEntry) => void
}): ReactElement {
  if (match.kind === 'none') {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0">{ui.notFound}</p>
        <p className="m-0 text-sm text-[#374151]">{ui.tryThese}</p>
        <Chips entries={match.suggestions} onAsk={onAsk} />
      </div>
    )
  }

  if (match.kind === 'term') {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0">{ui.termIntro}</p>
        <Quote quote={match.term} ui={ui} />
        <Sources ui={ui} guide={false} interpares />
      </div>
    )
  }

  const { entry, confident } = match
  const quotes = entry.interpares
    .map((id) => index.quote(id))
    .filter(Boolean) as InterparesQuote[]
  const related = entry.related
    .map((id) => index.entry(id))
    .filter(Boolean) as QaEntry[]

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-[#374151]">
        {ui.answering}: <strong>{entry.question}</strong>
        {!confident && <div className="mt-1 text-[#92400e]">{ui.notSure}</div>}
      </div>
      <div className="text-[16px] leading-relaxed">
        <Markdown
          text={entry.answer}
          className="[&_p]:mb-3 [&_p:last-child]:mb-0"
        />
      </div>
      {quotes.map((q) => (
        <Quote key={q.id} quote={q} ui={ui} />
      ))}
      <Sources ui={ui} guide interpares={quotes.length > 0} />
      {related.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-sm text-[#374151]">{ui.related}</span>
          <Chips entries={related} onAsk={onAsk} />
        </div>
      )}
    </div>
  )
}

export default function ArchivistQa(): ReactElement {
  const { locale } = useRouter()
  const lang = locale === 'ja' ? 'ja' : 'en'
  const ui = useLocaleContent(uiEn, uiJa)
  const corpus: QaCorpus = lang === 'ja' ? qaJa : qaEn

  // The terminology file is 2 MB; load it after the page is up.
  const [terms, setTerms] = useState<Record<string, InterparesTerm>>({})
  useEffect(() => {
    let cancelled = false
    import('../../../content/resources/glossary/terminology.v1.json').then(
      (m) => {
        if (!cancelled)
          setTerms(
            (m.default || m).termsById as unknown as Record<
              string,
              InterparesTerm
            >
          )
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const index = useMemo(
    () => new QaIndex(corpus, terms, { includeTerms: lang === 'en' }),
    [corpus, terms, lang]
  )

  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const nextId = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)

  // Switching language restarts the conversation: the answers are
  // language-specific text, not translations generated on the fly.
  useEffect(() => setTurns([]), [lang])

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length])

  const push = useCallback((question: string, match: QaMatch) => {
    setTurns((prev) => [...prev, { id: nextId.current++, question, match }])
  }, [])

  const ask = useCallback(
    (question: string) => {
      const q = question.trim()
      if (!q) return
      push(q, index.match(q))
      setInput('')
    },
    [index, push]
  )

  const askEntry = useCallback(
    (entry: QaEntry) =>
      push(entry.question, {
        kind: 'entry',
        entry,
        score: Infinity,
        confident: true
      }),
    [push]
  )

  const starters = uiEn.starters
    .map((id) => index.entry(id))
    .filter(Boolean) as QaEntry[]

  const chunksHref = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const json = JSON.stringify(toKnowledgeChunks(corpus, lang), null, 2)
    return URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  }, [corpus, lang])
  useEffect(
    () => () => {
      if (chunksHref) URL.revokeObjectURL(chunksHref)
    },
    [chunksHref]
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[860px] mx-auto text-[#0d0d0d]">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[17px]">{ui.intro}</p>
        <p className="m-0 text-sm text-[#374151]">{ui.howItWorks}</p>
        <p className="m-0 text-xs text-[#92400e]">{corpus.status}</p>
      </div>

      {turns.length === 0 && <Chips entries={starters} onAsk={askEntry} />}

      <div className="flex flex-col gap-6" aria-live="polite">
        {turns.map((t) => (
          <div key={t.id} className="flex flex-col gap-4">
            <div className="flex justify-end">
              <div className="max-w-[80%] px-4 py-3 bg-[#E5E7EB] rounded-2xl rounded-br-xs">
                <span className="sr-only">{ui.you}: </span>
                {t.question}
              </div>
            </div>
            <div className="border-t border-[#e5e7eb] pt-4">
              <Answer match={t.match} index={index} ui={ui} onAsk={askEntry} />
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-4 flex gap-2 items-end bg-white border border-[#d0d2dd] rounded-2xl p-2 shadow-sm"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              ask(input)
            }
          }}
          placeholder={ui.placeholder}
          aria-label={ui.placeholder}
          rows={2}
          className="flex-1 resize-none border-0 outline-none px-2 py-1 text-[16px] bg-transparent"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-full bg-black text-white px-5 h-10 text-sm font-medium disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          {ui.send}
        </button>
      </form>

      {turns.length > 0 && (
        <div>
          <button
            type="button"
            className="text-sm underline cursor-pointer"
            onClick={() => setTurns([])}
          >
            {ui.clear}
          </button>
        </div>
      )}

      <details className="border-t border-[#e5e7eb] pt-4">
        <summary className="cursor-pointer font-medium">
          {ui.allQuestions} ({corpus.entries.length})
        </summary>
        <ul className="mt-3 flex flex-col gap-1 pl-5 list-disc">
          {corpus.entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="text-left underline cursor-pointer"
                onClick={() => askEntry(e)}
              >
                {e.question}
              </button>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-xs text-[#6b7280] m-0">
        {ui.forDevelopers}:{' '}
        {chunksHref && (
          <a
            href={chunksHref}
            download={`archivist-qa-chunks.${lang}.json`}
            className="underline"
          >
            {ui.download}
          </a>
        )}
      </p>
    </div>
  )
}
