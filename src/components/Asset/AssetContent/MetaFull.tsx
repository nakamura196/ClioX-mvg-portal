import { ReactElement, useState, useEffect } from 'react'
import MetaItem from './MetaItem'
import ArchivistTerm from '@shared/ArchivistTerm'
import styles from './MetaFull.module.css'
import { useTranslation } from 'react-i18next'
import Publisher from '@shared/Publisher'
import { useAsset } from '@context/Asset'
import { Asset, LoggerInstance, Datatoken } from '@oceanprotocol/lib'
import { getPaymentCollector } from '@utils/ocean'
import { useProvider } from 'wagmi'
import { getDummySigner } from '@utils/wallet'

export default function MetaFull({ ddo }: { ddo: Asset }): ReactElement {
  const { isInPurgatory, assetState } = useAsset()
  const { t } = useTranslation('common')

  const [paymentCollector, setPaymentCollector] = useState<string>()

  useEffect(() => {
    if (!ddo) return

    async function getInitialPaymentCollector() {
      try {
        const signer = await getDummySigner(ddo.chainId)
        const datatoken = new Datatoken(signer)
        setPaymentCollector(
          await datatoken.getPaymentCollector(ddo.datatokens[0].address)
        )
      } catch (error) {
        LoggerInstance.error(
          '[MetaFull: getInitialPaymentCollector]',
          error.message
        )
      }
    }
    getInitialPaymentCollector()
  }, [ddo])

  function DockerImage() {
    const containerInfo = ddo?.metadata?.algorithm?.container
    const { image, tag } = containerInfo
    return <span>{`${image}:${tag}`}</span>
  }

  return ddo ? (
    <div className={styles.metaFull}>
      {!isInPurgatory && (
        <MetaItem
          title={t('asset.dataAuthor')}
          content={ddo?.metadata?.author}
        />
      )}
      <MetaItem
        title={<ArchivistTerm id="owner">{t('asset.owner')}</ArchivistTerm>}
        content={<Publisher account={ddo?.nft?.owner} />}
      />
      {assetState !== 'Active' && (
        <MetaItem
          title={
            <ArchivistTerm id="assetState">
              {t('asset.assetState')}
            </ArchivistTerm>
          }
          content={assetState}
        />
      )}
      {paymentCollector && paymentCollector !== ddo?.nft?.owner && (
        <MetaItem
          title={t('asset.revenueSentTo')}
          content={<Publisher account={paymentCollector} />}
        />
      )}

      {ddo?.metadata?.type === 'algorithm' && ddo?.metadata?.algorithm && (
        <MetaItem
          title={
            <ArchivistTerm id="dockerImage">
              {t('asset.dockerImage')}
            </ArchivistTerm>
          }
          content={<DockerImage />}
        />
      )}
      <MetaItem
        title={<ArchivistTerm id="did">{t('asset.did')}</ArchivistTerm>}
        content={<code>{ddo?.id}</code>}
      />
    </div>
  ) : null
}
