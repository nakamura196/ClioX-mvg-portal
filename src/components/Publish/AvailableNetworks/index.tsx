import { Fragment, ReactElement } from 'react'
import styles from './index.module.css'
import Network from './Network'
import useNetworkMetadata, {
  filterNetworksByType
} from '@hooks/useNetworkMetadata'
import contentEn from '../../../../content/publish/index.json'
import contentJa from '../../../../content/publish/index.ja.json'
import useLocaleContent from '../../../i18n/useLocaleContent'
import { useMarketMetadata } from '@context/MarketMetadata'

export default function AvailableNetworks(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const { networksList } = useNetworkMetadata()
  const { appConfig } = useMarketMetadata()

  const networksMain = filterNetworksByType(
    'mainnet',
    appConfig.chainIdsSupported,
    networksList
  )

  const networksTest = filterNetworksByType(
    'testnet',
    appConfig.chainIdsSupported,
    networksList
  )
  const networkCategories = [
    { title: 'Main', data: networksMain },
    { title: 'Test', data: networksTest }
  ]
  const networkList = (networks: number[]) =>
    networks.map((chainId) => (
      <li key={chainId}>
        <Network chainId={chainId} />
      </li>
    ))

  return (
    <div className={styles.content}>
      {content.tooltipAvailableNetworks}
      {networkCategories.map(
        (networkCategory) =>
          networkCategory.data.length > 0 && (
            <Fragment key={networkCategory.title}>
              <h4 className={styles.title}>{networkCategory.title}</h4>
              <ul className={styles.networks}>
                {networkList(networkCategory.data)}
              </ul>
            </Fragment>
          )
      )}
    </div>
  )
}
