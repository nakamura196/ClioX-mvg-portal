import { withSepoliaDids } from '@utils/useCaseDids' // [local patch]

const ARST_CHATBOT_ALGO_DIDS_DEFAULT: Record<number, string | string[]> = {
  32456:
    'did:op:8d7ea318e9d663bdc23971552e4d1489da0f1ff17e59328ef1cd85abb1ad26b2'
}

// [local patch] NEXT_PUBLIC_SEPOLIA_CHATBOT_ARST_ALGO_DIDS replaces the Sepolia entry (see @utils/useCaseDids)
export const ARST_CHATBOT_ALGO_DIDS = withSepoliaDids(
  ARST_CHATBOT_ALGO_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CHATBOT_ARST_ALGO_DIDS
)

export const CHATBOT_NAMESPACE = 'chatbot:arst'
