import AssetType from '@shared/AssetType'
import Time from '@shared/atoms/Time'
import Publisher from '@shared/Publisher'
import { getServiceByName } from '@utils/ddo'
import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './MetaInfo.module.css'

export default function MetaInfo({
  asset,
  nftPublisher,
  verifiedServiceProviderName
}: {
  asset: AssetExtended
  nftPublisher: string
  verifiedServiceProviderName?: string
}): ReactElement {
  const { t } = useTranslation('common')
  const isCompute = Boolean(getServiceByName(asset, 'compute'))
  const accessType = isCompute ? 'compute' : 'access'
  const nftOwner = asset?.nft?.owner

  return (
    <div className={styles.wrapper}>
      <AssetType
        type={
          asset?.metadata?.additionalInformation?.saas
            ? 'saas'
            : asset?.metadata.type
        }
        accessType={
          asset?.metadata?.additionalInformation?.saas ? 'saas' : accessType
        }
        className={styles.assetType}
      />
      <div className={styles.byline}>
        <div>
          {t('asset.published')}{' '}
          <Time date={asset?.metadata.created} relative />
          {(verifiedServiceProviderName ||
            (nftPublisher && nftPublisher !== nftOwner)) && (
            <span className={styles.publisher} data-jargon>
              {` ${t('asset.publishedBy')} `}{' '}
              <Publisher
                account={nftPublisher}
                verifiedServiceProviderName={verifiedServiceProviderName}
              />
            </span>
          )}
          {asset?.metadata.created !== asset?.metadata.updated && (
            <>
              {' — '}
              <span className={styles.updated}>
                {t('asset.updated')}{' '}
                <Time date={asset?.metadata.updated} relative />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
