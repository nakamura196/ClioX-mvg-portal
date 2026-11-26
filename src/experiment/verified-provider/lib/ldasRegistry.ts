/**
 * Registry of providers (publishers) verified by id.ldas.jp.
 *
 * The registry is a hand-maintained static file in the portal itself
 * (`public/registry/providers.json`, see docs/verified-providers.md), fetched in
 * the browser at runtime. If the fetch fails, no mark is shown and the
 * catalogue filter falls back to "show all". Entries older than the max age
 * (or without `verifiedAt`) are treated as unverified.
 */

export interface LdasProvider {
  name: string
  /** e.g. ["domain:u-tokyo.ac.jp", "orcid", "gakunin"] */
  method: string[]
  selfDeclaredName: boolean
  /** ISO timestamp of the credential check that led to listing */
  verifiedAt: string
}

export interface LdasRegistry {
  issuer: string
  updated: string
  providers: { [address: string]: LdasProvider }
}

export const LDAS_REGISTRY_URL =
  process.env.NEXT_PUBLIC_LDAS_REGISTRY_URL || '/registry/providers.json'

/** Entries older than this many days are treated as unverified. */
export const LDAS_REGISTRY_MAX_AGE_DAYS =
  Number(process.env.NEXT_PUBLIC_LDAS_REGISTRY_MAX_AGE_DAYS) || 365

/** True if `verifiedAt` is a valid date within maxAgeDays of `now`. */
export function isVerificationCurrent(
  verifiedAt: string | undefined,
  maxAgeDays: number = LDAS_REGISTRY_MAX_AGE_DAYS,
  now: number = Date.now()
): boolean {
  const time = verifiedAt ? Date.parse(verifiedAt) : NaN
  if (Number.isNaN(time)) return false
  return now - time <= maxAgeDays * 24 * 60 * 60 * 1000
}

/**
 * Returns a registry with lower-cased addresses, or undefined if malformed.
 * Expired entries (see isVerificationCurrent) are dropped.
 */
export function parseRegistry(
  raw: unknown,
  maxAgeDays: number = LDAS_REGISTRY_MAX_AGE_DAYS,
  now: number = Date.now()
): LdasRegistry | undefined {
  const data = raw as Partial<LdasRegistry>
  if (!data || typeof data !== 'object' || !data.providers) return undefined
  if (typeof data.providers !== 'object' || Array.isArray(data.providers))
    return undefined
  const providers: LdasRegistry['providers'] = {}
  for (const [address, value] of Object.entries(data.providers)) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || !value) continue
    if (!isVerificationCurrent(value.verifiedAt, maxAgeDays, now)) continue
    providers[address.toLowerCase()] = {
      name: typeof value.name === 'string' ? value.name : '',
      method: Array.isArray(value.method) ? value.method.map(String) : [],
      selfDeclaredName: value.selfDeclaredName === true,
      verifiedAt: value.verifiedAt
    }
  }
  return {
    issuer: String(data.issuer || ''),
    updated: String(data.updated || ''),
    providers
  }
}

export async function fetchRegistry(
  url: string = LDAS_REGISTRY_URL,
  signal?: AbortSignal
): Promise<LdasRegistry | undefined> {
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return undefined
    return parseRegistry(await response.json())
  } catch {
    return undefined
  }
}

/** Case-insensitive lookup. `registry` must come from parseRegistry. */
export function findProvider(
  registry: LdasRegistry | undefined,
  address: string | undefined
): LdasProvider | undefined {
  if (!registry || !address) return undefined
  return registry.providers[address.toLowerCase()]
}

/** Human-readable text for one method entry ("domain:x.jp" -> "x.jp domain"). */
export function describeMethod(method: string): {
  kind: string
  value?: string
} {
  const index = method.indexOf(':')
  return index === -1
    ? { kind: method }
    : { kind: method.slice(0, index), value: method.slice(index + 1) }
}
