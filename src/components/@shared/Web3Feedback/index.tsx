import { ReactElement, useEffect, useState } from 'react'
import Status from '@shared/atoms/Status'
import styles from './index.module.css'
import WalletNetworkSwitcher from '../WalletNetworkSwitcher'
import { useGraphSyncStatus } from '@hooks/useGraphSyncStatus'
import { useTranslation } from 'react-i18next'

export declare type Web3Error = {
  status: 'error' | 'warning' | 'success'
  title: string
  message?: string
}

export default function Web3Feedback({
  networkId,
  accountId,
  isAssetNetwork
}: {
  networkId: number
  accountId: string
  isAssetNetwork?: boolean
}): ReactElement {
  const { isGraphSynced, blockGraph, blockHead } = useGraphSyncStatus(networkId)
  const [state, setState] = useState<string>()
  const [title, setTitle] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [showFeedback, setShowFeedback] = useState<boolean>(false)
  const { t } = useTranslation('common')

  useEffect(() => {
    setShowFeedback(
      !accountId || isAssetNetwork === false || isGraphSynced === false
    )
    if (accountId && isAssetNetwork && isGraphSynced) return
    if (!accountId) {
      setState('error')
      setTitle(t('web3.noAccountTitle'))
      setMessage(t('profile.connectWallet'))
    } else if (isAssetNetwork === false) {
      setState('error')
      setTitle(t('web3.wrongNetworkTitle'))
      setMessage(t('profile.connectWallet'))
    } else if (isGraphSynced === false) {
      setState('warning')
      setTitle(t('web3.outOfSyncTitle'))
      setMessage(t('web3.outOfSyncMessage', { blockGraph, blockHead }))
    } else {
      setState('warning')
      setTitle(t('web3.genericTitle'))
      setMessage(t('error.generic'))
    }
  }, [accountId, isGraphSynced, isAssetNetwork])

  return showFeedback ? (
    <section className={styles.feedback}>
      <Status state={state} aria-hidden />
      <h3 className={styles.title}>{title}</h3>
      {isAssetNetwork === false ? (
        <WalletNetworkSwitcher />
      ) : (
        message && <p className={styles.error}>{message}</p>
      )}
    </section>
  ) : null
}
