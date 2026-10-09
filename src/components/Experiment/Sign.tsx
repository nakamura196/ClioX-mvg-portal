import { ReactElement, useState } from 'react'
import { utils } from 'ethers'
import { useAccount, useSigner, useNetwork, useSwitchNetwork } from 'wagmi'
import {
  EAS_NETWORK,
  SignedReceipt,
  easscanOffchainUrl,
  signReceipt
} from '@utils/receiptAttestation'
import type { TransactionReceipt } from '@utils/transactionFootprint'
import { download } from './shared'
import styles from './index.module.css'

type Content = typeof import('../../../content/experiment.json')['receipt']

/** 受取人アドレスの検査。大文字小文字が混ざっていてチェックサムが合わないものは弾く */
function recipientProblem(value: string, r: Content): string | null {
  if (!value) return null
  if (!utils.isAddress(value)) return r.recipientInvalid
  const mixed = value !== value.toLowerCase() && value !== value.toUpperCase()
  if (mixed && utils.getAddress(value.toLowerCase()) !== value) {
    return r.recipientChecksum
  }
  return null
}

export default function Sign({
  r,
  receipt
}: {
  r: Content
  receipt: TransactionReceipt
}): ReactElement {
  const { address } = useAccount()
  const { data: signer } = useSigner()
  const { chain } = useNetwork()
  const { switchNetworkAsync } = useSwitchNetwork()
  const [recipient, setRecipient] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [signed, setSigned] = useState<SignedReceipt>()
  const [link, setLink] = useState<string | null>(null)

  const problem = recipientProblem(recipient.trim(), r)
  const ready = !!recipient.trim() && !problem

  async function onSign() {
    setError('')
    setBusy(true)
    try {
      if (!signer) throw new Error(r.connectFirst)
      // MetaMask などは、署名の chainId と接続中のネットワークが違うと拒否する
      if (chain?.id !== EAS_NETWORK.chainId) {
        if (!switchNetworkAsync) throw new Error(r.signSwitch)
        await switchNetworkAsync(EAS_NETWORK.chainId)
      }
      const s = await signReceipt({
        receipt,
        recipient: utils.getAddress(recipient.trim().toLowerCase()),
        signer
      })
      setSigned(s)
      setLink(await easscanOffchainUrl(s.attestation.package))
    } catch (e) {
      setError(`${r.signFailed} ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.panel}>
      <h2>{r.signHeading}</h2>
      <p>{r.signIntro}</p>
      <p className={styles.note}>{r.signWhat}</p>
      <p className={styles.demo}>{r.signTestNote}</p>
      <label className={styles.field}>
        {r.recipientLabel}
        <input
          type="text"
          value={recipient}
          placeholder={r.recipientPlaceholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setRecipient(e.target.value)}
          aria-invalid={!!problem}
        />
      </label>
      {problem && <p className={styles.note}>{problem}</p>}
      {!address && <p className={styles.note}>{r.connectFirst}</p>}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          disabled={!ready || !address || busy}
          onClick={onSign}
        >
          {busy ? r.signing : r.signButton}
        </button>
      </div>
      {error && <p className={styles.note}>{error}</p>}
      {signed && (
        <>
          <p>{r.signedDone}</p>
          <dl className={styles.rows}>
            <div>
              <dt>{r.attester}</dt>
              <dd className={styles.mono}>
                {signed.attestation.package.signer}
              </dd>
            </div>
            <div>
              <dt>{r.recipient}</dt>
              <dd className={styles.mono}>
                {signed.attestation.package.sig.message.recipient}
              </dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                download(
                  `signed-receipt-${receipt.transactionId}.json`,
                  JSON.stringify(signed, null, 2) + '\n',
                  'application/json'
                )
              }
            >
              {r.downloadSigned}
            </button>
            {link && (
              <a
                className={`${styles.button} ${styles.secondary}`}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {r.easscanLink}
              </a>
            )}
          </div>
          <p className={styles.note}>{r.easscanNote}</p>
        </>
      )}
    </section>
  )
}
