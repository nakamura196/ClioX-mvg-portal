import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Input from '@shared/FormInput'
import { useVerifiedProviderContent } from './content'
import { useLdasRegistry } from './lib/useLdasRegistry'
import styles from './VerifiedFilter.module.css'

export interface VerifiedFilterState {
  /** Owner addresses to restrict the query to; undefined means do not filter */
  owners?: string[]
  /** True while the first query should wait for the registry */
  waiting: boolean
  /** The checkbox and hint to render above the results */
  control: ReactElement
}

/**
 * "Verified providers only" for the catalogue search. Off by default (the
 * catalogue shows everything); on when the URL says `verified=only`. If the registry could not be loaded, nothing can be
 * filtered: all providers are shown and the checkbox is disabled.
 */
export function useVerifiedFilter(
  parsed?: Record<string, unknown>
): VerifiedFilterState {
  const router = useRouter()
  const registry = useLdasRegistry()
  const { filter: c } = useVerifiedProviderContent()

  const requested = parsed?.verified === 'only'
  const failed = registry.status === 'failed'
  const owners =
    requested && registry.status === 'ready' ? registry.addresses : undefined

  function setVerifiedOnly(on: boolean) {
    const query = { ...router.query }
    delete query.page
    if (on) query.verified = 'only'
    else delete query.verified
    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true
    })
  }

  return {
    owners,
    waiting: requested && registry.status === 'loading',
    control: (
      <div className={styles.verifiedFilter}>
        <Input
          name="verifiedOnly"
          type="checkbox"
          options={[c.label]}
          checked={requested && !failed}
          disabled={failed}
          onChange={() => setVerifiedOnly(!requested)}
        />
        <p className={styles.verifiedHint} role="status">
          {failed ? c.unavailable : requested ? c.hint : c.hintAll}
        </p>
      </div>
    )
  }
}
