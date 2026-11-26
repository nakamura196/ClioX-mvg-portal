import { withSepoliaDid, withSepoliaDids } from '@utils/useCaseDids' // [local patch]

const CAMEROON_CHATBOT_ALGO_DIDS_DEFAULT: Record<number, string> = {
  32456:
    'did:op:5c7bb15392ac93d53fcd54adf1786352b9a16e25c4f93861ac87909bcb04f311'
}

// [local patch] NEXT_PUBLIC_SEPOLIA_CHATBOT_CAMEROON_ALGO_DID replaces the Sepolia entry (see @utils/useCaseDids)
export const CAMEROON_CHATBOT_ALGO_DIDS = withSepoliaDid(
  CAMEROON_CHATBOT_ALGO_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CHATBOT_CAMEROON_ALGO_DID
)

const CAMEROON_CHATBOT_DATASET_DIDS_DEFAULT: Record<number, string[]> = {
  32456: [
    'did:op:9798a934ce421e6c8da64c426f6b0b6ebf8ef947e4299cd25d785b24add62f56'
  ]
}

// [local patch] NEXT_PUBLIC_SEPOLIA_CHATBOT_CAMEROON_DATASET_DIDS replaces the Sepolia entry (see @utils/useCaseDids)
export const CAMEROON_CHATBOT_DATASET_DIDS = withSepoliaDids(
  CAMEROON_CHATBOT_DATASET_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CHATBOT_CAMEROON_DATASET_DIDS
)

export const CHATBOT_NAMESPACE = 'chatbot:cameroon'
