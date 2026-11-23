import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

export interface LdasUser {
  sub: string
  name: string
  orcid?: string
  memberOf?: string
  wallet?: string
  affiliation?: string
  emailDomain?: string
  issuer: string
  format: 'dc+sd-jwt' | 'vc+jwt'
  statusIndex?: string
  verifiedAt: string
}

interface LdasAuthContextValue {
  user: LdasUser | null
  authenticated: boolean
  loading: boolean
  issuerOrigin: string
  login: (returnPath?: string) => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const LdasAuthContext = createContext<LdasAuthContextValue>({
  user: null,
  authenticated: false,
  loading: false,
  issuerOrigin: 'https://id.ldas.jp',
  login: () => {},
  logout: async () => {},
  refresh: async () => {}
})

const RETURN_KEY = 'cliox_ldas_return_to'

export function consumeLdasReturnPath(): string {
  if (typeof window === 'undefined') return '/'
  const saved = window.sessionStorage.getItem(RETURN_KEY)
  window.sessionStorage.removeItem(RETURN_KEY)
  if (saved && saved.startsWith('/') && !saved.startsWith('//')) return saved
  return '/'
}

export function LdasAuthProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [user, setUser] = useState<LdasUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [issuerOrigin, setIssuerOrigin] = useState('https://id.ldas.jp')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/ldas/me', {
        credentials: 'same-origin'
      })
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data.authenticated ? data.user : null)
      if (data.issuerOrigin) setIssuerOrigin(data.issuerOrigin)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback((returnPath?: string) => {
    if (typeof window === 'undefined') return
    const target =
      returnPath || `${window.location.pathname}${window.location.search}`
    window.sessionStorage.setItem(RETURN_KEY, target)
    window.location.href = '/api/auth/ldas/start'
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/ldas/logout', {
        method: 'POST',
        credentials: 'same-origin'
      })
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <LdasAuthContext.Provider
      value={{
        user,
        authenticated: Boolean(user),
        loading,
        issuerOrigin,
        login,
        logout,
        refresh
      }}
    >
      {children}
    </LdasAuthContext.Provider>
  )
}

export function useLdasAuth(): LdasAuthContextValue {
  return useContext(LdasAuthContext)
}
