import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './index.module.css'
import useNetworkMetadata, {
  getNetworkDataById,
  getNetworkDisplayName
} from '@hooks/useNetworkMetadata'
import { NetworkIcon } from './NetworkIcon'

export default function NetworkName({
  networkId,
  minimal,
  className
}: {
  networkId: number
  minimal?: boolean
  className?: string
}): ReactElement {
  const { t } = useTranslation('common')
  const { networksList } = useNetworkMetadata()
  const networkData = getNetworkDataById(networksList, networkId)
  const networkName = getNetworkDisplayName(networkData)
  // ネットワーク名はチェーン定義由来なのでそのまま出すが、
  // 定義が見つからないときの 'Unknown' だけは UI 文言なので訳す。
  const networkLabel =
    networkName === 'Unknown' ? t('asset.unknownNetwork') : networkName

  return (
    <span
      className={`${styles.network} ${minimal ? styles.minimal : null} ${
        className || ''
      }`}
      title={networkLabel}
    >
      <NetworkIcon name={networkName} />
      <span className={styles.name}>{networkLabel}</span>
    </span>
  )
}
