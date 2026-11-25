/**
 * Registry of providers (publishers) verified by id.ldas.jp.
 *
 * id.ldas.jp serves `GET /registry/providers.json`. The portal is a static
 * export, so the file is fetched in the browser at runtime. If the fetch
 * fails, no mark is shown and the catalogue filter falls back to "show all".
 */

export interface LdasProvider {
  name: string
  /** e.g. ["domain:u-tokyo.ac.jp", "orcid", "gakunin"] */
  method: string[]
  selfDeclaredName: boolean
}

export interface LdasRegistry {
  issuer: string
  updated: string
  providers: { [address: string]: LdasProvider }
}

export const LDAS_REGISTRY_URL =
  process.env.NEXT_PUBLIC_LDAS_REGISTRY_URL ||
  'https://id.ldas.jp/registry/providers.json'

/** Returns a registry with lower-cased addresses, or undefined if malformed. */
export function parseRegistry(raw: unknown): LdasRegistry | undefined {
  const data = raw as Partial<LdasRegistry>
  if (!data || typeof data !== 'object' || !data.providers) return undefined
  if (typeof data.providers !== 'object' || Array.isArray(data.providers))
    return undefined
  const providers: LdasRegistry['providers'] = {}
  for (const [address, value] of Object.entries(data.providers)) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || !value) continue
    providers[address.toLowerCase()] = {
      name: typeof value.name === 'string' ? value.name : '',
      method: Array.isArray(value.method) ? value.method.map(String) : [],
      selfDeclaredName: value.selfDeclaredName === true
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
