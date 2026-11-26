import { withSepoliaDid, withSepoliaDids } from '@utils/useCaseDids' // [local patch]

const UDL_CHATBOT_ALGO_DIDS_DEFAULT: Record<number, string> = {
  32456:
    'did:op:5404dfc36448fb76f2bca918a05c67edb2f2d852e205862abbba2463b5916eba'
}

// [local patch] NEXT_PUBLIC_SEPOLIA_CHATBOT_UDL_ALGO_DID replaces the Sepolia entry (see @utils/useCaseDids)
export const UDL_CHATBOT_ALGO_DIDS = withSepoliaDid(
  UDL_CHATBOT_ALGO_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CHATBOT_UDL_ALGO_DID
)

const UDL_CHATBOT_DATASET_DIDS_DEFAULT: Record<number, string[]> = {
  32456: [
    'did:op:56e4bc5a77acbe7017496a5c7c0293879669d37ac6ee10d63481ee8b9f65a2f0',
    'did:op:cabf2569d3cc36aac7bd642d817fb79558026ce85a9b90000b3267b35c3894aa'
  ]
}

// [local patch] NEXT_PUBLIC_SEPOLIA_CHATBOT_UDL_DATASET_DIDS replaces the Sepolia entry (see @utils/useCaseDids)
export const UDL_CHATBOT_DATASET_DIDS = withSepoliaDids(
  UDL_CHATBOT_DATASET_DIDS_DEFAULT,
  process.env.NEXT_PUBLIC_SEPOLIA_CHATBOT_UDL_DATASET_DIDS
)

export const CHATBOT_NAMESPACE = 'chatbot:udl'
