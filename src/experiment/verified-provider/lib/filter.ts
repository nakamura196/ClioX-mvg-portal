import { getFilterTerm } from '@utils/aquarius'

const NO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Restricts results to assets whose NFT owner (the publisher) is one of the
 * given addresses. An empty list matches nothing (the registry is loaded but
 * lists no provider); do not call this when the registry is unavailable.
 * Both lower-case and the original spelling are sent because Elasticsearch
 * term matching is case-sensitive.
 */
export function getVerifiedOwnersFilter(owners: string[]): FilterTerm {
  const list = owners.length > 0 ? owners : [NO_ADDRESS]
  return getFilterTerm('nft.owner', [
    ...new Set(list.flatMap((a) => [a.toLowerCase(), a]))
  ])
}
