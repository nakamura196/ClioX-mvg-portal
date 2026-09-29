import { ReactElement } from 'react'
import Account from './Account'
import Details from './Details'
import Tooltip from '@shared/atoms/Tooltip'
import ArchivistTerm from '@shared/ArchivistTerm'
import styles from './index.module.css'
import { useAccount } from 'wagmi'
import { hideMetaMaskLogin } from 'app.config'

export default function Wallet(): ReactElement {
  const { address: accountId } = useAccount()

  return (
    // hide MetaMask login button, but show address when connected via json wallet
    (hideMetaMaskLogin !== 'true' || accountId) && (
      <div className={styles.wallet} data-tour="wallet">
        <Tooltip
          content={<Details />}
          trigger="click focus mouseenter"
          disabled={!accountId}
        >
          <Account />
        </Tooltip>
        {!accountId && (
          <span className={styles.hint}>
            <ArchivistTerm id="wallet" />
          </span>
        )}
      </div>
    )
  )
}
