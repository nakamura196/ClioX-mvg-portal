import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import PageTemplateAssetDetails from '../../../components/Asset'
import AssetProvider from '@context/Asset'
import { useDynamicParam } from '@utils/useDynamicParam'

export default function PageAssetDetails(): ReactElement {
  const router = useRouter()
  const did = useDynamicParam('did', 'asset')
  return (
    <AssetProvider did={did as string}>
      <PageTemplateAssetDetails uri={router.asPath} />
    </AssetProvider>
  )
}

// [local patch] The static export builds only the '_' page and the Cloudflare
// Worker serves it for every id. `next dev` has no Worker, so render on request there.
export async function getStaticPaths() {
  return {
    paths: [{ params: { did: '_' } }],
    fallback: process.env.NODE_ENV === 'development' ? 'blocking' : false
  }
}

export async function getStaticProps() {
  return { props: {} }
}
