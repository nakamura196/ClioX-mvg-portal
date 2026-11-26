import { ReactElement } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import styles from './Details.module.css'
import Avatar from '@components/@shared/atoms/Avatar'
import Bookmark from '@images/bookmark.svg'
import { MenuLink } from '../Menu'
import Button from '@components/@shared/atoms/Button'
import { JSON_WALLET_CONNECTOR_ID } from '@utils/wallet/EthersWalletConnector'

export default function Details(): ReactElement {
  const { address: accountId, connector: activeConnector } = useAccount()

  const { disconnect } = useDisconnect()

  return (
    <div className={styles.details}>
      <ul>
        <li className={styles.profileLink}>
          <Avatar accountId={accountId} />
          <MenuLink
            link="/profile"
            name="View Profile"
            className={styles.profileButton}
          />
        </li>
        <li className={styles.bookmarksLink}>
          <Bookmark />
          <MenuLink
            link="/bookmarks"
            name="View Bookmarks"
            className={styles.bookmarksButton}
          />
        </li>
        <li>
          <div title="Connected provider" className={styles.walletInfo}>
            <span className={styles.walletLogoWrap}>
              {activeConnector?.name}
            </span>
          </div>
          <div className={styles.actions}>
            {/* Switch Wallet disabled for json wallet */}
            {activeConnector?.id !== JSON_WALLET_CONNECTOR_ID && (
              <Button
                style="text"
                size="small"
                onClick={async () => {
                  // [local patch] Upstream called connect() with no connector,
                  // which does nothing. Ask the wallet to let the user pick
                  // which accounts this site may see; wagmi then follows the
                  // wallet's accountsChanged event to the chosen account.
                  const provider = await activeConnector?.getProvider()
                  if (provider?.request) {
                    try {
                      await provider.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }]
                      })
                    } catch (error) {
                      // The user closed the wallet's dialog: keep the account.
                      console.warn('[Switch Wallet]', error)
                    }
                    return
                  }
                  disconnect()
                  location.reload()
                }}
              >
                Switch Wallet
              </Button>
            )}
            <Button
              style="text"
              size="small"
              onClick={() => {
                disconnect()
                location.reload()
              }}
            >
              Disconnect
            </Button>
          </div>
        </li>
      </ul>
    </div>
  )
}
