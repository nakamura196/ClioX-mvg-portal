import { chains } from '../../chains.config'

// [local patch] Ocean Node の DDO（indexedMetadata.stats[].prices[].token）には
// 価格トークンのアドレスしか入っていない。一覧やカードで "0xfFf99…" と出ないよう、
// chains.config.js に書いたトークン（oceanTokenAddress と baseTokens）から記号を引く。
// 見つからなければ undefined を返し、表示側の既定値に任せる。
export function getTokenSymbol(
  chainId: number,
  address: string
): string | undefined {
  if (!address) return undefined
  const chain: any = chains.find((c: any) => c.chainId === chainId)
  if (!chain) return undefined
  const known = [
    { address: chain.oceanTokenAddress, symbol: chain.oceanTokenSymbol },
    ...(chain.baseTokens || [])
  ]
  return known.find((t) => t.address?.toLowerCase() === address.toLowerCase())
    ?.symbol
}
