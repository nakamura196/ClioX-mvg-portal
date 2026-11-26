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
import { useVerifiedFilter } from '@experiment/verified-provider/VerifiedFilter' // [prototype]

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
  // [prototype] "Verified providers only" (id.ldas.jp)
  const verified = useVerifiedFilter(parsed)
  const verifiedOwners = verified.owners
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
    if (verified.waiting) return

    fetchAssets(parsed, chainIds, verifiedOwners)
    // verifiedKey stands in for the verifiedOwners array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, chainIds, fetchAssets, verifiedKey, verified.waiting])

  return (
    <div className={styles.container}>
      <div className={styles.filterContainer}>
        <Filter addFiltersToUrl expanded />
        <Sort expanded />
      </div>
      <div className={styles.results}>
        {verified.control}
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
