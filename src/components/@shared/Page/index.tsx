import { ReactNode, ReactElement } from 'react'
import PageHeader from './PageHeader'
import Seo from './Seo'
import Container from '@shared/atoms/Container'
import SearchBar from '@components/Header/SearchBar'
import { useUserPreferences } from '@context/UserPreferences'
import ExternalContentWarning from '../ExternalContentWarning'
import { useTranslation } from 'react-i18next'
// [prototype] breadcrumbs on /experiment pages
import ExperimentBreadcrumb from '@experiment/shell/Breadcrumb'

export interface PageProps {
  children: ReactNode
  title?: string
  uri: string
  description?: string
  noPageHeader?: boolean
  headerCenter?: boolean
  noContainer?: boolean
  wideContainer?: boolean
}

export default function Page({
  children,
  title,
  uri,
  description,
  noPageHeader,
  headerCenter,
  noContainer,
  wideContainer
}: PageProps): ReactElement {
  const { allowExternalContent } = useUserPreferences()
  const { t } = useTranslation('common')

  // [local patch] the static export has no locale routing, so asPath keeps /ja
  const path = uri.replace(/^\/ja(?=\/|$)/, '') || '/'
  const isHome = path === '/'
  const isSearchPage = path.startsWith('/search')
  const isAssetPage = path.startsWith('/asset')

  // Only hide page header on home page or if explicitly specified
  const shouldHidePageHeader = noPageHeader || isHome

  const content = (
    <>
      {/* SearchBar is only shown on non-home pages */}
      {!isHome && (
        <SearchBar
          placeholder={t('search.placeholder')}
          isSearchPage={isSearchPage}
        />
      )}
      {isAssetPage && !allowExternalContent && <ExternalContentWarning />}
      <ExperimentBreadcrumb title={title} />
      {/* Display PageHeader when not hidden */}
      {!shouldHidePageHeader && title && (
        <PageHeader
          title={title}
          center={headerCenter}
          description={description}
          isHome={isHome}
        />
      )}
      {children}
    </>
  )

  return (
    <>
      <Seo title={title} description={description} uri={uri} />
      {noContainer ? (
        content
      ) : (
        <Container wide={wideContainer}>{content}</Container>
      )}
    </>
  )
}
