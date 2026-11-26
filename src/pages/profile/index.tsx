import { ReactElement, useEffect, useState } from 'react'
import Page from '@shared/Page'
import ProfilePage from '../../components/Profile'
import { accountTruncate } from '@utils/wallet'
import ProfileProvider from '@context/Profile'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { isAddress } from 'ethers/lib/utils'
import { useAutomation } from '../../@context/Automation/AutomationProvider'
// [local patch] static export serves the '_' shell; read the address from the URL
import { useDynamicParam } from '@utils/useDynamicParam'

export default function PageProfile(): ReactElement {
  const router = useRouter()
  const { address: accountId } = useAccount()
  const { autoWallet } = useAutomation()
  const [finalAccountId, setFinalAccountId] = useState<string>()
  const [ownAccount, setOwnAccount] = useState(false)
  const pathAccount = useDynamicParam('account', 'profile')

  // Have accountId in path take over, if not present fall back to web3
  useEffect(() => {
    async function init() {
      if (!router?.route) return

      // Path is root /profile, have web3 take over
      if (router.route === '/profile') {
        setFinalAccountId(accountId)
        setOwnAccount(true)
        return
      }

      // Path has ETH address
      if (isAddress(pathAccount)) {
        // addresses differ only in letter case between the URL and the wallet
        const lower = pathAccount.toLowerCase()
        setOwnAccount(
          lower === accountId?.toLowerCase() ||
            lower === autoWallet?.address?.toLowerCase()
        )
        const finalAccountId = pathAccount || accountId
        setFinalAccountId(finalAccountId)
      }
    }
    init()
  }, [router, pathAccount, accountId, autoWallet?.address])

  return (
    <Page
      uri={router.route}
      title={accountTruncate(finalAccountId)}
      noPageHeader
    >
      <ProfileProvider accountId={finalAccountId} ownAccount={ownAccount}>
        <ProfilePage accountId={finalAccountId} />
      </ProfileProvider>
    </Page>
  )
}
