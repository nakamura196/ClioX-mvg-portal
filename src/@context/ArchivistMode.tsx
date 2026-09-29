import {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import en from '../i18n/locales/en.json'
import ja from '../i18n/locales/ja.json'
import mergeLocaleContent from '../i18n/mergeLocaleContent'
import useLocaleContent from '../i18n/useLocaleContent'
import overlayEn from '../../content/archivistMode.json'
import overlayJa from '../../content/archivistMode.ja.json'

/**
 * "Archivist view": the same site, with crypto vocabulary replaced by archival
 * terms and on-chain details (addresses, token symbols, network names) hidden.
 *
 * Two mechanisms, so no page has to know about the mode:
 * - Words: the `common` i18n strings are swapped for the overrides in
 *   `content/archivistMode(.ja).json`. Only screen words are overridden, never
 *   data values from the chain.
 * - Details: elements marked `data-jargon` are hidden by a global CSS rule
 *   keyed on `<html data-view="archivist">`.
 *
 * The choice is kept in this browser only. `?view=archivist` / `?view=full`
 * sets it from a link, which is handy for demos.
 */

const STORAGE_KEY = 'cliox.archivistMode'

const originals = { en, ja }
const overlays = { en: overlayEn.common, ja: overlayJa.common }

interface ArchivistModeValue {
  archivistMode: boolean
  setArchivistMode: (value: boolean) => void
}

const ArchivistModeContext = createContext<ArchivistModeValue>({
  archivistMode: false,
  setArchivistMode: () => undefined
})

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function writeStored(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
  } catch {
    // Storage blocked (private mode etc.): the mode still works for this visit.
  }
}

export function ArchivistModeProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const router = useRouter()
  const { i18n } = useTranslation('common')
  const [archivistMode, setMode] = useState(false)

  // Read the stored choice after mount, so server and first client render agree.
  useEffect(() => {
    setMode(readStored())
  }, [])

  // A link can switch the mode: /asset/…?view=archivist
  const view = router.query?.view
  useEffect(() => {
    if (view !== 'archivist' && view !== 'full') return
    const next = view === 'archivist'
    setMode(next)
    writeStored(next)
  }, [view])

  useEffect(() => {
    document.documentElement.dataset.view = archivistMode ? 'archivist' : 'full'
    for (const lng of ['en', 'ja'] as const) {
      const bundle = archivistMode
        ? mergeLocaleContent(originals[lng], overlays[lng])
        : originals[lng]
      // Shallow replace of the whole namespace (deep = false) keeps the
      // imported locale objects untouched, so switching back is exact.
      i18n.addResourceBundle(lng, 'common', bundle, false, true)
    }
    // Re-render every useTranslation() consumer with the new strings.
    i18n.emit('languageChanged', i18n.language)
  }, [archivistMode, i18n])

  const setArchivistMode = useCallback((value: boolean) => {
    setMode(value)
    writeStored(value)
  }, [])

  return (
    <ArchivistModeContext.Provider value={{ archivistMode, setArchivistMode }}>
      {children}
    </ArchivistModeContext.Provider>
  )
}

export function useArchivistMode(): ArchivistModeValue {
  return useContext(ArchivistModeContext)
}

/**
 * `useLocaleContent` plus the archivist overlay, for the `content/*.json`
 * files that are not i18n strings (form labels and the like).
 */
export function useArchivistContent<T>(
  base: T,
  ja: unknown,
  key: keyof typeof overlayEn
): T {
  const { archivistMode } = useArchivistMode()
  const { locale } = useRouter()
  const localized = useLocaleContent(base, ja)
  if (!archivistMode) return localized
  const overlay = (locale === 'ja' ? overlayJa : overlayEn)[key]
  return mergeLocaleContent(localized, overlay)
}

/** The toggle and banner texts, in the current locale. */
export function useArchivistModeUi() {
  return useLocaleContent(overlayEn, overlayJa).ui
}
