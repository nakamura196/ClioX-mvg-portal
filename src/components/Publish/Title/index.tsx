import { ReactElement } from 'react'
import NetworkName from '@shared/NetworkName'
import Tooltip from '@shared/atoms/Tooltip'
import styles from './index.module.css'
import contentEn from '../../../../content/publish/index.json'
import contentJa from '../../../../content/publish/index.ja.json'
import useLocaleContent from '../../../i18n/useLocaleContent'
import Info from '@images/info.svg'
import AvailableNetworks from '@components/Publish/AvailableNetworks'
import useNetworkMetadata from '@hooks/useNetworkMetadata'
import { useAccount } from 'wagmi'
import { useTranslation } from 'react-i18next'

export default function Title({
  networkId
}: {
  networkId: number
}): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const { t } = useTranslation('common')
  const { address: accountId } = useAccount()
  const { isSupportedOceanNetwork } = useNetworkMetadata()

  return (
    <>
      {content.title}{' '}
      {networkId && (
        <>
          {t('publish.into')}
          <NetworkName
            networkId={networkId}
            className={
              isSupportedOceanNetwork || !accountId
                ? styles.network
                : `${styles.network} ${styles.error}`
            }
          />
          <Tooltip
            content={<AvailableNetworks />}
            className={
              isSupportedOceanNetwork || !accountId
                ? styles.tooltip
                : `${styles.tooltip} ${styles.error}`
            }
          >
            <Info className={styles.infoIcon} />
          </Tooltip>
        </>
      )}
    </>
  )
}
