import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import EditPage from '../../../components/Asset/Edit'
import AssetProvider from '@context/Asset'
import { useDynamicParam } from '@utils/useDynamicParam'

export default function PageEditAsset(): ReactElement {
  const router = useRouter()
  const did = useDynamicParam('did', 'asset')
  return (
    <AssetProvider did={did as string}>
      <EditPage uri={router.pathname} />
    </AssetProvider>
  )
}

export async function getStaticPaths() {
  return { paths: [{ params: { did: '_' } }], fallback: false }
}

export async function getStaticProps() {
  return { props: {} }
}
