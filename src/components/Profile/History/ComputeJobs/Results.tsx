import {
  ComputeResultType,
  downloadFileBrowser,
  LoggerInstance,
  Provider
} from '@oceanprotocol/lib'
import { ReactElement, useEffect, useState } from 'react'
import { ListItem } from '@shared/atoms/Lists'
import Button from '@shared/atoms/Button'
import styles from './Results.module.css'
import FormHelp from '@shared/FormInput/Help'
import contentEn from '../../../../../content/pages/history.json'
import contentJa from '../../../../../content/pages/history.ja.json'
import useLocaleContent from '../../../../i18n/useLocaleContent'
import { useCancelToken } from '@hooks/useCancelToken'
import { getAsset } from '@utils/aquarius'
import { useAccount, useSigner } from 'wagmi'
import { toast } from 'react-toastify'
import { prettySize } from '@components/@shared/FormInput/InputElement/FilesInput/utils'
import { useAutomation } from '../../../../@context/Automation/AutomationProvider'
import { safeErrorMessage } from '../../../../@utils/safeError'
import {
  buildComputeResultUrlViaOceanNode,
  downloadUrlAsFile,
  isLocalOceanNode
} from '../../../../@utils/oceanNodeAuth'

export default function Results({
  job
}: {
  job: ComputeJobMetaData
}): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const providerInstance = new Provider()
  const { address: accountId } = useAccount()
  const { autoWallet } = useAutomation()
  const { data: signer } = useSigner()

  const [datasetProvider, setDatasetProvider] = useState<string>()
  const newCancelToken = useCancelToken()

  const isFinished = job.dateFinished !== null

  useEffect(() => {
    async function getAssetMetadata() {
      // Ocean Node 3.2.0 のジョブには inputDID が無いことがある。
      // 無いまま [0] を取ると Results がまるごと落ち、成果物のボタンが出ない。
      const did = job.inputDID?.[0]
      if (!did) return
      const ddo = await getAsset(did, newCancelToken())
      setDatasetProvider(ddo?.services?.[0]?.serviceEndpoint)
    }
    getAssetMetadata()
  }, [job.inputDID, newCancelToken])

  function getDownloadButtonValue(
    type: ComputeResultType,
    name: string
  ): string {
    let buttonName
    switch (type) {
      case 'output':
        buttonName = `RESULTS (${name})`
        break
      case 'algorithmLog':
        buttonName = 'ALGORITHM LOGS'
        break
      case 'configrationLog':
        buttonName = 'CONFIGURATION LOGS'
        break
      case 'publishLog':
        buttonName = 'PUBLISH LOGS'
        break
      default:
        buttonName = `RESULTS (${name})`
        break
    }
    return buttonName
  }

  async function downloadResults(resultIndex: number) {
    if (!accountId || !job) return

    // owner が無いジョブでも落ちないようにする（try の外なので捕捉されない）
    const signerToUse =
      job.owner?.toLowerCase() === autoWallet?.address?.toLowerCase()
        ? autoWallet
        : signer

    try {
      // Ocean Node 3.2.0 は署名対象が変わっている
      // （consumerAddress + nonce + "getComputeResult"）。
      // ocean.js 3.1.3 は旧方式で署名するため、手元のノードでは弾かれる。
      const jobResult = isLocalOceanNode(datasetProvider)
        ? await buildComputeResultUrlViaOceanNode(
            signerToUse as any,
            datasetProvider,
            job.jobId,
            resultIndex,
            (job as any).environment
          )
        : await providerInstance.getComputeResultUrl(
            datasetProvider,
            signerToUse,
            job.jobId,
            resultIndex
          )
      // ノードは Content-Disposition を返さないため、downloadFileBrowser に
      // 任せると拡張子なしの `file` で保存される。既に分かっている名前を使う。
      const filename = job.results?.[resultIndex]?.filename
      if (isLocalOceanNode(datasetProvider) && filename) {
        await downloadUrlAsFile(jobResult, filename)
      } else {
        await downloadFileBrowser(jobResult)
      }
    } catch (error) {
      const message = safeErrorMessage(error.message)
      LoggerInstance.error('[Provider Get c2d results url] Error:', message)
      toast.error(message)
    }
  }

  return (
    <div className={styles.results}>
      <h4 className={styles.title}>Results</h4>
      {isFinished ? (
        <ul>
          {job.results &&
            Array.isArray(job.results) &&
            job.results.map((jobResult, i) =>
              jobResult.filename ? (
                <ListItem key={i}>
                  <Button
                    style="text"
                    size="small"
                    className={styles.downloadButton}
                    onClick={() => {
                      downloadResults(i)
                    }}
                    download
                  >
                    {`${getDownloadButtonValue(
                      jobResult.type,
                      jobResult.filename
                    )} - ${prettySize(jobResult.filesize)}`}
                  </Button>
                </ListItem>
              ) : (
                <ListItem key={i}>No results found.</ListItem>
              )
            )}
        </ul>
      ) : (
        <p> Waiting for results...</p>
      )}
      <FormHelp className={styles.help}>{content.compute.storage}</FormHelp>
    </div>
  )
}
