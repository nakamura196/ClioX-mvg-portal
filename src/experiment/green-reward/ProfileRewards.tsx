// [prototype] Green reward line on the profile (2026-11-27): total PLAY received
// from GreenReward (its received/receivedCount for this address) and the
// address's PLAY balance. Public chain records, so shown on anyone's profile.
import { ReactElement, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import useActiveLocale from '../../i18n/useActiveLocale'
import { getOceanConfig } from '@utils/ocean'
import { GREEN_REWARD_DEFAULTS } from '../../../worker/greenReward'
import styles from './ProfileRewards.module.css'

const CHAIN_ID = 11155111
const EXPLORER = 'https://eth-sepolia.blockscout.com'
// The contract keeps each address's total and count (received/receivedCount),
// so no event scan is needed. Same address as the checker uses.
const ABI = [
  'function received(address) view returns (uint256)',
  'function receivedCount(address) view returns (uint256)',
  'function token() view returns (address)'
]
const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
]

interface View {
  total: string
  count: number
  balance: string
  symbol: string
}

export default function ProfileRewards({
  accountId
}: {
  accountId: string
}): ReactElement {
  const ja = useActiveLocale() === 'ja'
  const [view, setView] = useState<View>()

  useEffect(() => {
    if (!ethers.utils.isAddress(accountId || '')) return
    let live = true
    const provider = new ethers.providers.JsonRpcProvider(
      getOceanConfig(CHAIN_ID).nodeUri
    )
    const c = new ethers.Contract(GREEN_REWARD_DEFAULTS.contract, ABI, provider)
    ;(async () => {
      const tokenAddr: string = await c.token()
      const token = new ethers.Contract(tokenAddr, TOKEN_ABI, provider)
      const [total, count, bal, symbol, decimals] = await Promise.all([
        c.received(accountId),
        c.receivedCount(accountId),
        token.balanceOf(accountId),
        token.symbol(),
        token.decimals()
      ])
      if (live)
        setView({
          total: ethers.utils.formatUnits(total, decimals),
          count: count.toNumber(),
          balance: ethers.utils.formatUnits(bal, decimals),
          symbol
        })
    })().catch(() => live && setView(undefined))
    return () => {
      live = false
    }
  }, [accountId])

  // Show the line only to people who have received a reward.
  if (!view || view.count === 0) return null
  return (
    <p className={styles.line}>
      <strong>{ja ? '環境リワード' : 'Green reward'}</strong>
      <span>
        {ja
          ? `受け取った合計 ${view.total} ${view.symbol}（${view.count} 件）`
          : `received ${view.total} ${view.symbol} (${view.count} job${
              view.count === 1 ? '' : 's'
            })`}
      </span>
      <span>
        {ja ? '財布の' : 'wallet'} {view.symbol} {ja ? '残高' : 'balance'}{' '}
        {view.balance}
      </span>
      <a
        href={`${EXPLORER}/address/${accountId}?tab=token_transfers`}
        target="_blank"
        rel="noreferrer"
      >
        {ja ? '記録を見る' : 'records'}
      </a>
    </p>
  )
}
