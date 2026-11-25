import { useEffect, useState } from 'react'
import {
  fetchRegistry,
  findProvider,
  LdasProvider,
  LdasRegistry
} from '@utils/ldasRegistry'

export type LdasRegistryStatus = 'loading' | 'ready' | 'failed'

// One fetch per page load, shared by every component that uses the hook.
let sharedPromise: Promise<LdasRegistry | undefined> | undefined
let sharedResult: { registry?: LdasRegistry } | undefined

function load(): Promise<LdasRegistry | undefined> {
  if (!sharedPromise) {
    sharedPromise = fetchRegistry().then((registry) => {
      sharedResult = { registry }
      return registry
    })
  }
  return sharedPromise
}

export interface UseLdasRegistry {
  status: LdasRegistryStatus
  registry?: LdasRegistry
  /** Case-insensitive; undefined while loading, on failure, or if not listed */
  getProvider: (address: string) => LdasProvider | undefined
  /** Verified addresses, lower-case */
  addresses: string[]
}

export function useLdasRegistry(): UseLdasRegistry {
  const [state, setState] = useState<{
    status: LdasRegistryStatus
    registry?: LdasRegistry
  }>(() =>
    sharedResult
      ? {
          status: sharedResult.registry ? 'ready' : 'failed',
          registry: sharedResult.registry
        }
      : { status: 'loading' }
  )

  useEffect(() => {
    let cancelled = false
    load().then((registry) => {
      if (cancelled) return
      setState({ status: registry ? 'ready' : 'failed', registry })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    status: state.status,
    registry: state.registry,
    getProvider: (address: string) => findProvider(state.registry, address),
    addresses: state.registry ? Object.keys(state.registry.providers) : []
  }
}

// for tests
export function resetLdasRegistryCache(): void {
  sharedPromise = undefined
  sharedResult = undefined
}
