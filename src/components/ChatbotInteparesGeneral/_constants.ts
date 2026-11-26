import { withSepoliaDids } from '@utils/useCaseDids' // [local patch]

const INTEPARES_GENERAL_CHATBOT_ALGO_DIDS_DEFAULT: Record<
  number,
  string[] | string
> = {
  32456: [
    'did:op:bb83fe22d731132cde6c576cf1d0eb4c5746c9277dd60831039168e9d0237552'
  ]
}

// [local patch] NEXT_PUBLIC_SEPOLIA_CHATBOT_INTERPARES_ALGO_DIDS replaces the Sepolia entry (see @utils/useCaseDids)
export const INTEPARES_GENERAL_CHATBOT_ALGO_DIDS = withSepoliaDids(
  INTEPARES_GENERAL_CHATBOT_ALGO_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CHATBOT_INTERPARES_ALGO_DIDS
)

const INTEPARES_GENERAL_CHATBOT_DATASET_DIDS_DEFAULT: Record<number, string[]> =
  {
    32456: [
      'did:op:48de50c007c75a08030ce556c95b729eaff7878845775a6d71a317ba035defbd',
      'did:op:aa94e2cc073cbf6c905c36be3d33282ce049e25f383795c41936b61362df1877'
    ]
  }

// [local patch] NEXT_PUBLIC_SEPOLIA_CHATBOT_INTERPARES_DATASET_DIDS replaces the Sepolia entry (see @utils/useCaseDids)
export const INTEPARES_GENERAL_CHATBOT_DATASET_DIDS = withSepoliaDids(
  INTEPARES_GENERAL_CHATBOT_DATASET_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CHATBOT_INTERPARES_DATASET_DIDS
)

export const CHATBOT_NAMESPACE = 'chatbot:intepares-general'
