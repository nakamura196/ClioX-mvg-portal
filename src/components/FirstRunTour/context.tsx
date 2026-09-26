import {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { tourSteps } from './steps'

type TourStatus = 'idle' | 'active' | 'done' | 'dismissed'

interface TourState {
  status: TourStatus
  step: number
}

interface TourContextValue extends TourState {
  start: (fromStep?: number) => void
  goTo: (step: number) => void
  stop: () => void
  finish: () => void
}

// Browser-only memory of where the viewer left the tour. Nothing is sent
// anywhere; clearing site data simply shows the welcome card again.
const STORAGE_KEY = 'cliox.firstRunTour.v1'

function readState(): TourState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TourState) : null
  } catch {
    return null
  }
}

function writeState(state: TourState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage blocked (private mode etc.): the tour still works for this visit.
  }
}

const TourContext = createContext<TourContextValue>(null)

export function FirstRunTourProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [state, setState] = useState<TourState>({ status: 'idle', step: 0 })

  // First visit: open the welcome card. A paused tour resumes where it was.
  useEffect(() => {
    const saved = readState()
    setState(saved ?? { status: 'active', step: 0 })
  }, [])

  const update = useCallback((next: TourState) => {
    setState(next)
    writeState(next)
  }, [])

  const value: TourContextValue = {
    ...state,
    start: (fromStep = 0) => update({ status: 'active', step: fromStep }),
    goTo: (step) =>
      update({
        status: 'active',
        step: Math.max(0, Math.min(step, tourSteps.length - 1))
      }),
    stop: () => update({ status: 'dismissed', step: state.step }),
    finish: () => update({ status: 'done', step: 0 })
  }

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useFirstRunTour(): TourContextValue {
  return useContext(TourContext)
}
