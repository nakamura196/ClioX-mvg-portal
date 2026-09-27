// Mark published assets as "deprecated" (Ocean metadata state 2: replaced by a
// newer version). The record stays on chain and stays readable; the portal
// stops offering it as a current asset.
//
// Usage (the key comes from 1Password via cli.zsh's environment):
//   PRIVATE_KEY=... RPC=... NODE_URL=... node deprecate.mjs <did> [<did> ...]
import { Nft } from '@oceanprotocol/lib'
import { JsonRpcProvider, Wallet } from 'ethers'

const DEPRECATED = 2
const { PRIVATE_KEY, RPC, NODE_URL } = process.env
const provider = new JsonRpcProvider(RPC)
const signer = new Wallet(PRIVATE_KEY, provider)
const chainId = Number((await provider.getNetwork()).chainId)
const nft = new Nft(signer, chainId)

for (const did of process.argv.slice(2)) {
  const res = await fetch(`${NODE_URL}/api/aquarius/assets/ddo/${did}`)
  if (!res.ok)
    throw new Error(`${did}: not found on ${NODE_URL} (${res.status})`)
  const { nftAddress } = await res.json()
  const tx = await nft.setMetadataState(
    nftAddress,
    await signer.getAddress(),
    DEPRECATED
  )
  const receipt = await tx.wait()
  console.log(`${did} -> deprecated (tx ${receipt.hash})`)
}
