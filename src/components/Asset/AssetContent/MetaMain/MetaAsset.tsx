import { useAsset } from '@context/Asset'
import { Asset } from '@oceanprotocol/lib'
import AddToken from '@shared/AddToken'
import Publisher from '@shared/Publisher'
import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccount } from 'wagmi'
import ExplorerTokenLink from '../../../@shared/ExplorerLink/ExplorerTokenLink'
import styles from './MetaAsset.module.css'

export default function MetaAsset({
  asset
}: {
  asset: AssetExtended
}): ReactElement {
  const { t } = useTranslation('common')
  const { isAssetNetwork } = useAsset()
  const { connector: activeConnector } = useAccount()

  const dataTokenSymbol = asset?.datatokens[0]?.symbol

  return (
    <div className={styles.wrapper}>
      <span className={styles.owner}>
        {t('asset.ownedBy')} &nbsp;
        <Publisher account={asset?.nft?.owner} showName={true} />
      </span>
      <span>
        <ExplorerTokenLink
          tokenAddress={asset?.services?.[0]?.datatokenAddress}
          networkId={asset?.chainId}
          className={styles.datatoken}
        >
          {t('asset.accessedWith', { symbol: dataTokenSymbol })}
        </ExplorerTokenLink>
        {activeConnector?.name === 'MetaMask' && isAssetNetwork && (
          <span className={styles.addWrap}>
            <AddToken
              // service を持たない資産が実在するため、途中で切らない
              address={asset?.services?.[0]?.datatokenAddress}
              symbol={(asset as Asset)?.datatokens[0]?.symbol}
              text={t('asset.addToWallet', {
                symbol: (asset as Asset)?.datatokens[0]?.symbol
              })}
              className={styles.add}
              minimal
            />
          </span>
        )}
      </span>
    </div>
  )
}
