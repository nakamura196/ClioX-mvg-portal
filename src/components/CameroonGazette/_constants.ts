import { withSepoliaDid } from '@utils/useCaseDids' // [local patch]
import type { UseCaseConfig } from '../@shared/VizHub/types'

/**
 * Mapping of { chainId: useCaseAlgorithmDID }
 * TODO: Update with correct CameroonGazette algorithm DID
 */
const CAMEROON_GAZETTE_ALGO_DIDS_DEFAULT: Record<number, string> = {
  32456:
    'did:op:81d57f431deebbd2e74561eac4875da42276afa3cbcf910d27ee8b2425193b0f'
}

// [local patch] NEXT_PUBLIC_SEPOLIA_CAMEROON_GAZETTE_ALGO_DID replaces the Sepolia entry (see @utils/useCaseDids)
export const CAMEROON_GAZETTE_ALGO_DIDS = withSepoliaDid(
  CAMEROON_GAZETTE_ALGO_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CAMEROON_GAZETTE_ALGO_DID
)

export const CAMEROON_GAZETTE_USECASE_NAME = 'cameroonGazette'

export const CAMEROON_GAZETTE_RESULT_ZIP = {
  fileName: 'result.zip',
  metadataFileName: 'metadata.json',
  detectionsFileName: 'detections.json',
  imagesFolderName: 'images'
}

/**
 * Configuration for Cameroon Gazette use case
 */
export const CAMEROON_GAZETTE_CONFIG: UseCaseConfig = {
  useCaseName: CAMEROON_GAZETTE_USECASE_NAME,
  algoDids: CAMEROON_GAZETTE_ALGO_DIDS,
  resultZip: CAMEROON_GAZETTE_RESULT_ZIP
}

/**
 * VizHub configuration for Cameroon Gazette - demonstrating different needs
 */
export const CAMEROON_GAZETTE_VIZHUB_CONFIG = {
  // Component visibility - different from TextAnalysis
  components: {
    timeline: true,
    documentSummary: true,
    wordCloud: true,
    sentiment: true,
    histogram: true,
    futureFeatures: false
  },

  // Customization for gazette-specific terminology
  customization: {
    timeline: {
      title: 'Gazette Publication Timeline',
      xAxisLabel: 'Publication Date',
      yAxisLabel: 'Number of Gazettes'
    },
    histogram: {
      title: 'Gazette Volume Distribution',
      xAxisLabel: 'Gazettes per Day',
      yAxisLabel: 'Publication Frequency',
      unit: 'gazette publications'
    }
  }
}
