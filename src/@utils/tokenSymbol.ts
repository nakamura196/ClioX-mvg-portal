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

// Price tokens offered on the publish form for a chain (chains.config.js
// `baseTokens`), or undefined when the chain lists none and the subgraph's
// approved tokens should be used instead.
export function getConfiguredBaseTokens(
  chainId: number
): TokenInfo[] | undefined {
  const chain: any = chains.find((c: any) => c.chainId === chainId)
  const tokens: TokenInfo[] = chain?.baseTokens?.filter(
    (t: TokenInfo) => t.address && t.symbol && t.decimals !== undefined
  )
  return tokens?.length > 0
    ? tokens.map((t) => ({ ...t, name: t.name || t.symbol }))
    : undefined
}

// The token preselected on the publish form: the chain's
// `defaultBaseTokenSymbol`, else `fallbackSymbol`, else the first token.
export function pickDefaultBaseToken(
  tokens: TokenInfo[] | undefined,
  chainId: number | undefined,
  fallbackSymbol?: string
): TokenInfo | undefined {
  if (!tokens?.length) return undefined
  const chain: any = chains.find((c: any) => c.chainId === chainId)
  const wanted = (
    chain?.defaultBaseTokenSymbol ||
    fallbackSymbol ||
    ''
  ).toLowerCase()
  return (
    (wanted && tokens.find((t) => t.symbol?.toLowerCase() === wanted)) ||
    tokens[0]
  )
}
