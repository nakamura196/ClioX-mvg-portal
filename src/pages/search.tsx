import { ReactElement, useState } from 'react'
import Search from '../components/Search'
import Page from '@shared/Page'
import { accountTruncate } from '@utils/wallet'
import { MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS } from '@utils/aquarius'
import { useRouter } from 'next/router'
import { isAddress } from 'ethers/lib/utils'
import { useTranslation } from 'react-i18next'

export default function PageSearch(): ReactElement {
  const router = useRouter()
  const { t } = useTranslation('common')
  const parsed = router.query
  const { text, owner, tags, categories } = parsed
  const [totalResults, setTotalResults] = useState<number>()
  const [totalPagesNumber, setTotalPagesNumber] = useState<number>()

  const isETHAddress = isAddress(text as string)
  const searchValue =
    (isETHAddress ? accountTruncate(text as string) : text) ||
    tags ||
    categories
  const hasSearchTerm = searchValue && searchValue !== ' '

  const title = owner
    ? t('search.publishedBy', { owner: accountTruncate(owner as string) })
    : totalResults === undefined
    ? t('search.searching')
    : hasSearchTerm
    ? totalResults === 0
      ? t('search.noResults')
      : t('search.resultsCountFor', {
          count: totalResults,
          term: searchValue
        })
    : t('search.resultsCount', { count: totalResults })

  return (
    <Page
      title={
        totalPagesNumber > MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS
          ? hasSearchTerm
            ? t('search.tooManyResultsFor', { term: searchValue })
            : t('search.tooManyResults')
          : title
      }
      description={
        totalPagesNumber &&
        totalPagesNumber > MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS
          ? t('search.tooManyResultsHint')
          : undefined
      }
      uri={router.route}
    >
      <Search
        setTotalResults={setTotalResults}
        setTotalPagesNumber={setTotalPagesNumber}
      />
    </Page>
  )
}
