import {
  CSSProperties,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import tourEn from '../../../content/firstRunTour.json'
import tourJa from '../../../content/firstRunTour.ja.json'
import useLocaleContent from '../../i18n/useLocaleContent'
import { useFirstRunTour } from './context'
import { isOnStepPage, tourSteps } from './steps'
import styles from './index.module.css'

// How long to wait for a highlighted part of the page to appear. Asset pages
// fetch from the metadata cache and the chain, which takes a few seconds.
const FIND_TIMEOUT_MS = 15000
const POLL_MS = 300
const SPOTLIGHT_PADDING = 6
const GAP = 14
const MARGIN = 16

type Rect = { top: number; left: number; width: number; height: number }

function findTargetRect(selectors: string[]): Rect | null {
  const rects: DOMRect[] = []
  for (const selector of selectors) {
    let nodes: NodeListOf<Element>
    try {
      nodes = document.querySelectorAll(selector)
    } catch {
      continue // `:has()` unsupported: treat as not found
    }
    nodes.forEach((node) => {
      const r = node.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) rects.push(r)
    })
  }
  if (!rects.length) return null
  const top = Math.min(...rects.map((r) => r.top))
  const left = Math.min(...rects.map((r) => r.left))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  const right = Math.max(...rects.map((r) => r.right))
  return { top, left, width: right - left, height: bottom - top }
}

function scrollTargetIntoView(selectors: string[]) {
  const rect = findTargetRect(selectors)
  if (!rect) return
  // On phones the card is a bottom sheet, so keep the highlight near the top.
  const tall = rect.height > window.innerHeight * 0.6 || window.innerWidth < 640
  const top = tall
    ? window.scrollY + rect.top - 120
    : window.scrollY + rect.top - (window.innerHeight - rect.height) / 2
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

/** Where the card goes: next to the highlight if it fits, else a corner. */
function placeCard(
  rect: Rect | null,
  card: { width: number; height: number }
): CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!rect)
    return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

  const clampX = (x: number) =>
    Math.max(MARGIN, Math.min(x, vw - card.width - MARGIN))
  const clampY = (y: number) =>
    Math.max(MARGIN, Math.min(y, vh - card.height - MARGIN))
  const bottom = rect.top + rect.height + SPOTLIGHT_PADDING
  const top = rect.top - SPOTLIGHT_PADDING
  const right = rect.left + rect.width + SPOTLIGHT_PADDING
  const left = rect.left - SPOTLIGHT_PADDING

  if (bottom + GAP + card.height <= vh - MARGIN)
    return { top: bottom + GAP, left: clampX(rect.left) }
  if (top - GAP - card.height >= MARGIN)
    return { top: top - GAP - card.height, left: clampX(rect.left) }
  if (right + GAP + card.width <= vw - MARGIN)
    return { top: clampY(Math.max(rect.top, MARGIN)), left: right + GAP }
  if (left - GAP - card.width >= MARGIN)
    return {
      top: clampY(Math.max(rect.top, MARGIN)),
      left: left - GAP - card.width
    }
  return { bottom: MARGIN, right: MARGIN }
}

export default function FirstRunTour(): ReactElement {
  const tour = useFirstRunTour()
  const router = useRouter()
  const text = useLocaleContent(tourEn, tourJa)
  const cardRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [lost, setLost] = useState(false)
  const [cardSize, setCardSize] = useState({ width: 380, height: 260 })
  const [narrow, setNarrow] = useState(false)

  const active = tour?.status === 'active'
  const index = tour?.step ?? 0
  const step = tourSteps[index]
  const onPage = step ? isOnStepPage(step, router.asPath) : false
  const stepText = step && text.steps[step.id]

  // Find the highlighted part, scroll to it once, then follow it as the page
  // scrolls, resizes or finishes loading.
  useEffect(() => {
    setRect(null)
    setLost(false)
    if (!active || !step?.target) return
    if (!onPage) {
      // Give a navigation started by Next/Back time to land before saying
      // the viewer is somewhere else.
      const timer = window.setTimeout(() => setLost(true), 2500)
      return () => window.clearTimeout(timer)
    }
    let scrolled = false
    const startedAt = Date.now()
    const tick = () => {
      const found = findTargetRect(step.target)
      if (found && !scrolled) {
        scrolled = true
        scrollTargetIntoView(step.target)
      }
      setRect(found)
      setLost(!found && Date.now() - startedAt > FIND_TIMEOUT_MS)
    }
    tick()
    const timer = window.setInterval(tick, POLL_MS)
    const onMove = () => setRect(findTargetRect(step.target))
    window.addEventListener('scroll', onMove, { passive: true })
    window.addEventListener('resize', onMove)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('scroll', onMove)
      window.removeEventListener('resize', onMove)
    }
  }, [active, index, onPage, step])

  // Phones get a bottom sheet instead of a card next to the highlight.
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 640)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The card's height depends on the text, so measure it after each render
  // (the size check stops this from looping).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!active || !el) return
    const { width, height } = el.getBoundingClientRect()
    if (width !== cardSize.width || height !== cardSize.height)
      setCardSize({ width, height })
  })

  // Move keyboard and screen-reader focus to the card on every step.
  useEffect(() => {
    if (active) cardRef.current?.focus({ preventScroll: true })
  }, [active, index, lost])

  const goToStep = useCallback(
    (next: number) => {
      const target = tourSteps[next]
      if (!target) return
      if (target.path && !isOnStepPage(target, router.asPath)) {
        router.push(target.path)
      }
      tour.goTo(next)
    },
    [router, tour]
  )

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tour.stop()
      if (e.key === 'ArrowRight' && index < tourSteps.length - 1)
        goToStep(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) goToStep(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, index, goToStep, tour])

  if (!active || !step || !stepText) return null

  const isFirst = index === 0
  const isLast = index === tourSteps.length - 1
  const showLost = lost && !!step.target
  const spotlight =
    rect && !showLost
      ? {
          top: rect.top - SPOTLIGHT_PADDING,
          left: rect.left - SPOTLIGHT_PADDING,
          width: rect.width + SPOTLIGHT_PADDING * 2,
          height: rect.height + SPOTLIGHT_PADDING * 2
        }
      : null
  const cardStyle = narrow
    ? undefined
    : placeCard(spotlight ? rect : null, cardSize)
  const progress = text.progress
    .replace('{current}', String(index + 1))
    .replace('{total}', String(tourSteps.length))
  const safe = 'safe' in stepText ? (stepText.safe as string) : null

  return (
    <div className={styles.tour}>
      {/* Clicks on the page are paused while the tour runs. */}
      <div
        className={spotlight ? styles.blocker : styles.blockerDim}
        aria-hidden="true"
      />
      {spotlight && (
        <div className={styles.spotlight} style={spotlight} aria-hidden />
      )}

      <div
        ref={cardRef}
        className={narrow ? styles.cardSheet : styles.card}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-tour-title"
        tabIndex={-1}
      >
        {!isFirst && <p className={styles.progress}>{progress}</p>}

        {showLost ? (
          <>
            <h2 id="first-run-tour-title" className={styles.title}>
              {text.lostTitle}
            </h2>
            <p className={styles.body}>{text.lostBody}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => goToStep(index + 1)}
              >
                {text.skip}
              </button>
              {step.path && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => router.push(step.path)}
                >
                  {text.goBack}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 id="first-run-tour-title" className={styles.title}>
              {stepText.title}
            </h2>
            <p className={styles.body}>{stepText.body}</p>
            {safe && <p className={styles.safe}>{safe}</p>}

            {step.id === 'finish' && (
              <div className={styles.links}>
                <h3>{text.steps.finish.linksHeading}</h3>
                <ul>
                  <li>
                    <Link
                      href="/resources?tab=glossary"
                      onClick={() => tour.finish()}
                    >
                      {text.steps.finish.glossaryLink}
                    </Link>
                  </li>
                </ul>
                <p className={styles.note}>{text.steps.finish.restartNote}</p>
              </div>
            )}

            <div className={styles.actions}>
              {isFirst ? (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => tour.stop()}
                >
                  {text.notNow}
                </button>
              ) : isLast ? (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => goToStep(1)}
                >
                  {text.restart}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => goToStep(index - 1)}
                >
                  {text.back}
                </button>
              )}
              <button
                type="button"
                className={styles.primary}
                onClick={() => (isLast ? tour.finish() : goToStep(index + 1))}
              >
                {isFirst ? text.start : isLast ? text.finish : text.next}
              </button>
            </div>
          </>
        )}

        {!isFirst && !isLast && (
          <button
            type="button"
            className={styles.stop}
            onClick={() => tour.stop()}
          >
            {text.stop}
          </button>
        )}
      </div>
    </div>
  )
}
