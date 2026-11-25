import { useEffect, useState } from 'react'
import { gql, OperationContext, useQuery } from 'urql'
import { getQueryContext } from '@utils/subgraph'

// Everything the chain witnessed about one record: changes to its
// description, changes of custody, and granted requests. The subgraph is an
// index of chain events, so each row carries the transaction that proves it.
const getProvenance = gql`
  query Provenance($nft: String!, $datatokens: [String!]!) {
    nftUpdates(where: { nft: $nft }, orderBy: timestamp, orderDirection: asc) {
      id
      tx
      timestamp
      type
      assetState
    }
    nftTransferHistories(
      where: { nft: $nft }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      txId
      timestamp
      oldOwner {
        id
      }
      newOwner {
        id
      }
    }
    orders(
      where: { datatoken_in: $datatokens }
      orderBy: createdTimestamp
      orderDirection: desc
      first: 100
    ) {
      id
      tx
      createdTimestamp
      consumer {
        id
      }
    }
  }
`

export interface ProvenanceEvent {
  id: string
  tx: string
  timestamp: number
  kind: 'update' | 'minted' | 'transfer'
  type?: string
  from?: string
  to?: string
}

export interface UseEvent {
  id: string
  tx: string
  timestamp: number
  consumer: string
}

export interface Provenance {
  loading: boolean
  events: ProvenanceEvent[]
  uses: UseEvent[]
}

export default function useProvenanceEvents(asset: AssetExtended): Provenance {
  const [queryContext, setQueryContext] = useState<OperationContext>()

  useEffect(() => {
    if (!asset) return
    setQueryContext(getQueryContext(asset.chainId))
  }, [asset])

  const nft = asset?.nft?.address?.toLowerCase()
  const datatokens = (asset?.datatokens || []).map((dt) =>
    dt.address.toLowerCase()
  )

  const [result] = useQuery({
    query: getProvenance,
    variables: { nft, datatokens },
    context: queryContext,
    pause: !queryContext || !nft
  })
  const { data, fetching } = result

  const updates: ProvenanceEvent[] = (data?.nftUpdates || [])
    // A description change also rewrites the display card in the same
    // transaction. Listing both reads as two events when there was one.
    .filter(
      (u, _, all) =>
        u.type !== 'TOKENURI_UPDATED' ||
        !all.some((o) => o.tx === u.tx && o.type !== 'TOKENURI_UPDATED')
    )
    .map((u) => ({
      id: u.id,
      tx: u.tx,
      timestamp: Number(u.timestamp),
      kind: 'update' as const,
      type: u.type
    }))

  const transfers: ProvenanceEvent[] = (data?.nftTransferHistories || []).map(
    (t) => ({
      id: t.id,
      tx: t.txId,
      timestamp: Number(t.timestamp),
      // The subgraph records the creation of the register entry as a
      // "transfer" to the same account it came from.
      kind:
        t.oldOwner.id === t.newOwner.id
          ? ('minted' as const)
          : ('transfer' as const),
      from: t.oldOwner.id,
      to: t.newOwner.id
    })
  )

  const events = [...transfers, ...updates].sort(
    (a, b) => a.timestamp - b.timestamp
  )

  const uses: UseEvent[] = (data?.orders || []).map((o) => ({
    id: o.id,
    tx: o.tx,
    timestamp: Number(o.createdTimestamp),
    consumer: o.consumer.id
  }))

  return { loading: !data && (fetching || !queryContext), events, uses }
}
