import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import Page from '@shared/Page'
import Alert from '@shared/atoms/Alert'
import Loader from '@shared/atoms/Loader'
import AssetProvider, { useAsset } from '@context/Asset'
import FindingAid from '@components/FindingAid'

function FindingAidPage({ uri }: { uri: string }): ReactElement {
  const { asset, title, error, isInPurgatory, loading } = useAsset()

  if (error) {
    return (
      <Page title={title} noPageHeader uri={uri}>
        <Alert title={title} text={error} state="error" />
      </Page>
    )
  }
  if (!asset || loading) {
    return (
      <Page title={undefined} uri={uri}>
        <Loader />
      </Page>
    )
  }
  return (
    <Page title={isInPurgatory ? '' : title} uri={uri}>
      <FindingAid />
    </Page>
  )
}

export default function PageFindingAid(): ReactElement {
  const router = useRouter()
  const { did } = router.query
  return (
    <AssetProvider did={did as string}>
      <FindingAidPage uri={router.asPath} />
    </AssetProvider>
  )
}
