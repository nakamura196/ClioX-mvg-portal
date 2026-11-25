import { ReactElement, useState, useEffect, useCallback } from 'react'
import AssetList from '@shared/AssetList'
import queryString from 'query-string'
import Filter from './Filter'
import Sort from './sort'
import { getResults, updateQueryStringParameter } from './utils'
import { useUserPreferences } from '@context/UserPreferences'
import { useCancelToken } from '@hooks/useCancelToken'
import styles from './index.module.css'
import { useRouter } from 'next/router'
import { useDebouncedCallback } from 'use-debounce'
import { useTranslation } from 'react-i18next'
import Input from '@shared/FormInput'
import { useLdasRegistry } from '@hooks/useLdasRegistry'

export default function SearchPage({
  setTotalResults,
  setTotalPagesNumber
}: {
  setTotalResults: (totalResults: number) => void
  setTotalPagesNumber: (totalPagesNumber: number) => void
}): ReactElement {
  const router = useRouter()
  const [parsed, setParsed] = useState<queryString.ParsedQuery<string>>()
  const { chainIds } = useUserPreferences()
  const [queryResult, setQueryResult] = useState<PagedAssets>()
  const [loading, setLoading] = useState<boolean>(true)
  const newCancelToken = useCancelToken()
  const { t } = useTranslation('common')
  const registry = useLdasRegistry()

  // "Verified providers only" is on unless the URL says `verified=all`.
  // If the registry could not be loaded, nothing can be filtered: show all.
  const verifiedOnlyRequested = parsed?.verified !== 'all'
  const registryFailed = registry.status === 'failed'
  const registryLoading = registry.status === 'loading'
  const verifiedOwners =
    verifiedOnlyRequested && registry.status === 'ready'
      ? registry.addresses
      : undefined
  const verifiedKey = verifiedOwners ? verifiedOwners.join(',') : ''

  useEffect(() => {
    const parsed = queryString.parse(location.search, {
      arrayFormat: 'separator'
    })
    setParsed(parsed)
  }, [router])

  const updatePage = useCallback(
    (page: number) => {
      const { pathname, query } = router
      const newUrl = updateQueryStringParameter(
        pathname +
          '?' +
          JSON.stringify(query)
            .replace(/"|{|}/g, '')
            .replace(/:/g, '=')
            .replace(/,/g, '&'),
        'page',
        `${page}`
      )
      return router.push(newUrl)
    },
    [router]
  )

  const fetchAssets = useDebouncedCallback(
    async (
      parsed: queryString.ParsedQuery<string>,
      chainIds: number[],
      verifiedOwners?: string[]
    ) => {
      setLoading(true)
      setTotalResults(undefined)
      const queryResult = await getResults(
        parsed,
        chainIds,
        newCancelToken(),
        verifiedOwners
      )
      setQueryResult(queryResult)

      setTotalResults(queryResult?.totalResults || 0)
      setTotalPagesNumber(queryResult?.totalPages || 0)
      setLoading(false)
    },
    500
  )
  useEffect(() => {
    if (!parsed || !queryResult) return
    const { page } = parsed
    if (queryResult.totalPages < Number(page)) updatePage(1)
  }, [parsed, queryResult, updatePage])

  useEffect(() => {
    if (!parsed || !chainIds) return
    // wait for the registry so the first query is already filtered
    if (verifiedOnlyRequested && registryLoading) return

    fetchAssets(parsed, chainIds, verifiedOwners)
    // verifiedKey stands in for the verifiedOwners array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parsed,
    chainIds,
    fetchAssets,
    verifiedKey,
    verifiedOnlyRequested,
    registryLoading
  ])

  function setVerifiedOnly(on: boolean) {
    const query = { ...router.query }
    delete query.page
    if (on) delete query.verified
    else query.verified = 'all'
    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.filterContainer}>
        <Filter addFiltersToUrl expanded />
        <Sort expanded />
      </div>
      <div className={styles.results}>
        <div className={styles.verifiedFilter}>
          <Input
            name="verifiedOnly"
            type="checkbox"
            options={[t('verifiedFilter.label')]}
            checked={verifiedOnlyRequested && !registryFailed}
            disabled={registryFailed}
            onChange={() => setVerifiedOnly(!verifiedOnlyRequested)}
          />
          <p className={styles.verifiedHint} role="status">
            {registryFailed
              ? t('verifiedFilter.unavailable')
              : verifiedOnlyRequested
              ? t('verifiedFilter.hint')
              : t('verifiedFilter.hintAll')}
          </p>
        </div>
        <AssetList
          assets={queryResult?.results}
          showPagination
          isLoading={loading}
          page={queryResult?.page}
          totalPages={queryResult?.totalPages}
          onPageChange={updatePage}
          showAssetViewSelector
        />
      </div>
    </div>
  )
}
