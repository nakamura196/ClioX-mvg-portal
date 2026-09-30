import { ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUseCases } from '../../../@context/UseCases'
import { chatbotApi } from '../../../@utils/chatbot'
import type { ChatbotUseCaseData } from '../../../@context/UseCases/models/Chatbot.model'
import type { ChatbotResult } from './_types'

// A prepared knowledge file, so the chatbot can be tried without running a
// compute job first. The file is the same final_output.json the knowledge
// algorithm writes; it is stored like a job result under a made-up job id.
export interface ChatbotSample {
  url: string
  jobId: string
  assetName: string
  datasetDid?: string
}

type Status = 'uploading' | 'processing' | 'no-knowledge'

export default function SampleKnowledge({
  sample,
  namespace,
  onStatusChange
}: {
  sample: ChatbotSample
  namespace: string
  onStatusChange: (s: Status) => void
}): ReactElement {
  const { t } = useTranslation('common')
  const { chatbotList, createOrUpdateChatbot } = useUseCases()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loaded = chatbotList?.some(
    (row) => row.namespace === namespace && row.job?.jobId === sample.jobId
  )

  async function load() {
    setBusy(true)
    setError(null)
    onStatusChange('uploading')
    try {
      const response = await fetch(sample.url)
      if (!response.ok) throw new Error(`${response.status}`)
      const chunks = await response.json()
      const result: ChatbotResult[] = [
        {
          knowledgeBase: { chunks },
          domainInfo: {
            domain: sample.jobId.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
            entities: [],
            description: sample.assetName
          }
        }
      ]
      const row: ChatbotUseCaseData = {
        job: {
          jobId: sample.jobId,
          assetName: sample.assetName,
          inputDID: sample.datasetDid ? [sample.datasetDid] : []
        } as unknown as ComputeJobMetaData,
        result,
        namespace
      }
      await createOrUpdateChatbot(row)
      const upload = await chatbotApi.uploadKnowledge([row])
      if (!upload.success) throw new Error(upload.message || 'upload failed')
      onStatusChange('processing')
    } catch (e) {
      setError((e as Error).message)
      onStatusChange('no-knowledge')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#d0d2dd] bg-white px-4 py-3 text-sm">
      <span className="flex-1 min-w-[240px]">
        {loaded
          ? t('chatbot.sampleLoaded', { name: sample.assetName })
          : t('chatbot.sampleOffer', { name: sample.assetName })}
      </span>
      {!loaded && (
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="rounded-md bg-[#1a1a2e] px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? t('chatbot.sampleLoading') : t('chatbot.sampleButton')}
        </button>
      )}
      {error && (
        <span role="alert" className="w-full text-red-700">
          {t('chatbot.sampleError')} ({error})
        </span>
      )}
    </div>
  )
}
