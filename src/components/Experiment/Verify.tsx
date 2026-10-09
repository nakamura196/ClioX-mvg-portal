import { ReactElement, useState } from 'react'
import { VerifyResult, verifySignedReceipt } from '@utils/receiptAttestation'
import { canonicalSha256, stripHexPrefix } from '@utils/canonicalJson'
import type { SignedReceipt } from '@utils/receiptAttestation'
import styles from './index.module.css'

type Content = typeof import('../../../content/experiment.json')['receipt']

async function readJson(file: File): Promise<unknown> {
  return JSON.parse(await file.text())
}

export default function Verify({ r }: { r: Content }): ReactElement {
  const [signedFile, setSignedFile] = useState<unknown>()
  const [sourceFile, setSourceFile] = useState<unknown>()
  const [parseError, setParseError] = useState('')

  const result: VerifyResult | undefined =
    signedFile === undefined ? undefined : verifySignedReceipt(signedFile)
  const expectedSource = (signedFile as SignedReceipt | undefined)?.receipt
    ?.source?.sha256
  let sourceOk: boolean | undefined
  if (sourceFile !== undefined && expectedSource) {
    try {
      sourceOk = stripHexPrefix(canonicalSha256(sourceFile)) === expectedSource
    } catch {
      sourceOk = false
    }
  }

  async function pick(
    e: React.ChangeEvent<HTMLInputElement>,
    set: (v: unknown) => void
  ) {
    setParseError('')
    const f = e.target.files?.[0]
    if (!f) return set(undefined)
    try {
      set(await readJson(f))
    } catch (err) {
      set(undefined)
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }

  const checks = Object.entries(r.checks) as [
    keyof VerifyResult['checks'],
    string
  ][]

  return (
    <section className={styles.panel} data-testid="verify">
      <h2>{r.verifyHeading}</h2>
      <p>{r.verifyIntro}</p>
      <label className={styles.field}>
        {r.verifyFile}
        <input
          type="file"
          accept="application/json,.json"
          data-testid="verify-signed"
          onChange={(e) => pick(e, setSignedFile)}
        />
      </label>
      <label className={styles.field}>
        {r.verifySourceFile}
        <input
          type="file"
          accept="application/json,.json"
          data-testid="verify-source"
          onChange={(e) => pick(e, setSourceFile)}
        />
      </label>
      <p className={styles.note}>{r.verifySourceHelp}</p>
      {parseError && <p className={styles.note}>{parseError}</p>}
      {result && (
        <>
          <p>
            <strong>
              {result.ok && sourceOk !== false ? r.verifyOk : r.verifyNg}
            </strong>
          </p>
          {result.reason && <p className={styles.note}>{result.reason}</p>}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {checks.map(([k, label]) => (
                  <tr key={k}>
                    <td>{label}</td>
                    <td>{result.checks[k] ? r.pass : r.fail}</td>
                  </tr>
                ))}
                {sourceOk !== undefined && (
                  <tr>
                    <td>{sourceOk ? r.sourceCheck : r.sourceCheckNg}</td>
                    <td>{sourceOk ? r.pass : r.fail}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {result.attester && (
            <dl className={styles.rows}>
              <div>
                <dt>{r.attester}</dt>
                <dd className={styles.mono}>{result.attester}</dd>
              </div>
              <div>
                <dt>{r.recipient}</dt>
                <dd className={styles.mono}>{result.recipient}</dd>
              </div>
              <div>
                <dt>{r.signedAt}</dt>
                <dd className={styles.mono}>
                  {result.time
                    ? new Date(result.time * 1000).toISOString()
                    : ''}
                </dd>
              </div>
              <div>
                <dt>{r.signedHashes}</dt>
                <dd className={styles.mono}>
                  <div>{result.receiptSha256}</div>
                  <div>{result.sourceSha256}</div>
                  <div>{result.method}</div>
                </dd>
              </div>
            </dl>
          )}
          <p className={styles.note}>{r.verifyCaveat}</p>
        </>
      )}
    </section>
  )
}
