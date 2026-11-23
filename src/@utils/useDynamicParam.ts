import { useRouter } from 'next/router'

/**
 * Resolves a dynamic route parameter (e.g. `did` in `/asset/[did]`, `account`
 * in `/profile/[account]`) in both standard Next.js routing and Cloudflare
 * static export, where the exported shell has placeholder `_` and the real
 * value is in `window.location.pathname`.
 */
export function useDynamicParam(
  paramName: string,
  segmentPrefix: string
): string | undefined {
  const router = useRouter()
  const raw = router.query[paramName]
  const fromQuery = Array.isArray(raw) ? raw[0] : raw
  if (fromQuery && fromQuery !== '_') return fromQuery

  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname.replace(/^\/ja(?=\/|$)/, '')
    const re = new RegExp(`^/${segmentPrefix}/([^/]+)`)
    const m = re.exec(pathname)
    if (m && m[1] && m[1] !== '_') {
      try {
        return decodeURIComponent(m[1])
      } catch {
        return m[1]
      }
    }
  }
  return fromQuery === '_' ? undefined : fromQuery
}
