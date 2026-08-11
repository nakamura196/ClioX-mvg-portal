import { ReactElement, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Time from '@shared/atoms/Time'
import Button from '@shared/atoms/Button'
import Modal from '@shared/atoms/Modal'
import External from '@images/external.svg'
import { getAsset } from '@utils/aquarius'
import Results from './Results'
import styles from './Details.module.css'
import { useCancelToken } from '@hooks/useCancelToken'
import MetaItem from '../../../Asset/AssetContent/MetaItem'
import { useMarketMetadata } from '@context/MarketMetadata'

function Asset({
  title,
  symbol,
  did
}: {
  title: string
  symbol: string
  did: string
}) {
  return (
    <div className={styles.asset}>
      <h3 className={styles.assetTitle}>
        {title || '(名称不明)'}{' '}
        {/* Ocean Node 3.2.0 のジョブは algoDID を返さないことがある。
            無いまま描くと /asset/null へのリンクになるので、その場合は出さない。 */}
        {did && (
          <a
            className={styles.assetLink}
            href={`/asset/${did}`}
            target="_blank"
            rel="noreferrer"
          >
            <External />
          </a>
        )}
      </h3>
      <p className={styles.assetMeta}>
        {symbol && <span className={styles.assetMeta}> {`${symbol} | `}</span>}
        <code className={styles.assetMeta}>{did || '(DID なし)'}</code>
      </p>
    </div>
  )
}

function DetailsAssets({ job }: { job: ComputeJobMetaData }) {
  const { appConfig } = useMarketMetadata()
  const newCancelToken = useCancelToken()

  const [algoName, setAlgoName] = useState<string>()
  const [algoDtSymbol, setAlgoDtSymbol] = useState<string>()

  useEffect(() => {
    async function getAlgoMetadata() {
      if (!job.algoDID) return
      const ddo = await getAsset(job.algoDID, newCancelToken())
      if (!ddo) return
      setAlgoDtSymbol(ddo.datatokens?.[0]?.symbol)
      setAlgoName(ddo.metadata?.name)
    }
    getAlgoMetadata()
  }, [appConfig.metadataCacheUri, job.algoDID, newCancelToken])

  return (
    <>
      <Asset
        title={job.assetName}
        symbol={job.assetDtSymbol}
        did={job.inputDID?.[0] ?? ''}
      />
      <Asset title={algoName} symbol={algoDtSymbol} did={job.algoDID} />
    </>
  )
}

export default function Details({
  job
}: {
  job: ComputeJobMetaData
}): ReactElement {
  const { t } = useTranslation('common')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <>
      <Button style="text" size="small" onClick={() => setIsDialogOpen(true)}>
        {t('compute.showDetails')}
      </Button>
      <Modal
        title={t(`compute.status.${job.statusText}`, {
          defaultValue: job.statusText
        })}
        isOpen={isDialogOpen}
        onToggleModal={() => setIsDialogOpen(false)}
      >
        <DetailsAssets job={job} />
        <Results job={job} />

        <div className={styles.meta}>
          <MetaItem
            title={t('compute.columns.created')}
            content={<Time date={job.dateCreated} isUnix relative />}
          />
          {job.dateFinished && (
            <MetaItem
              title={t('compute.columns.finished')}
              content={<Time date={job.dateFinished} isUnix relative />}
            />
          )}
          <MetaItem
            title={t('compute.jobId')}
            content={<code>{job.jobId}</code>}
          />
        </div>
      </Modal>
    </>
  )
}
