import { ReactElement } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { isComputeDemo } from '@experiment/footprint/demoEnvs'
import { useArchivistMode } from '@experiment/archivist/context'
import styles from './index.module.css'

// [prototype] 試作・見本であることを、画面の上端に常に出す帯（2026-11-25）。
// - illustrative: 事業者も数値も説明用の架空のもの（2 条件の実験・図 1・?demo=1 の資料ページ）
// - prototype: 試作の機能。本番のポータルの一部ではない（/experiment の下のほかのページ）
// - trial: ふつうのページ。このサイト全体が Sepolia の試験版であることと、
//   /experiment（試作と設定）への入口を細い 1 行で示す。言語・アーキビスト表示が
//   既定と違うときは、その旨を同じ行に足す（ヘッダーに切り替えが無いため、戻し方を示す）
const ILLUSTRATIVE_PATHS = ['/experiment/two-condition']

const TEXT = {
  illustrative: [
    'Illustrative example. The providers and all footprint values on this page are fictitious and are not provider claims.',
    '見本です。この画面の事業者と、電力・水・炭素などの値は、すべて説明用の架空のものです。事業者の申告値ではありません。'
  ],
  prototype: [
    'Experimental prototype. Not part of the production Clio-X portal.',
    '試作の機能です。Clio-X のポータルの正式な機能ではありません。'
  ],
  label: ['Illustrative', '見本'],
  labelPrototype: ['Prototype', '試作'],
  all: ['All prototypes', '試作の一覧'],
  trial: ['Clio-X trial (Sepolia test network)', 'Clio-X の試験版（Sepolia）'],
  trialLink: ['Prototypes and settings →', '試作と設定 →'],
  on: ['On:', 'オン:'],
  ja: ['Japanese', '日本語'],
  archivist: ['Archivist view', 'アーキビスト表示']
}

export function bannerKind(
  pathname: string,
  query: Record<string, unknown>
): 'illustrative' | 'prototype' | 'trial' {
  if (ILLUSTRATIVE_PATHS.includes(pathname)) return 'illustrative'
  if (pathname.startsWith('/asset/') && isComputeDemo(query))
    return 'illustrative'
  if (pathname === '/experiment' || pathname.startsWith('/experiment/'))
    return 'prototype'
  return 'trial'
}

export default function PrototypeBanner(): ReactElement {
  const router = useRouter()
  const { i18n } = useTranslation('common')
  const { archivistMode } = useArchivistMode()
  const i = (i18n?.language || 'en').startsWith('ja') ? 1 : 0
  const kind = bannerKind(router.pathname, router.query)
  const illustrative = kind === 'illustrative'

  if (kind === 'trial') {
    const on = [
      i === 1 ? TEXT.ja[i] : '',
      archivistMode ? TEXT.archivist[i] : ''
    ].filter(Boolean)
    return (
      <div className={`${styles.banner} ${styles.trial}`} role="note">
        <span>{TEXT.trial[i]}</span>
        {on.length > 0 && (
          <span className={styles.on}>
            {TEXT.on[i]} {on.join(' · ')}
          </span>
        )}
        <Link href="/experiment" className={styles.link}>
          {TEXT.trialLink[i]}
        </Link>
      </div>
    )
  }

  return (
    <div
      className={`${styles.banner} ${
        illustrative ? styles.illustrative : styles.prototype
      }`}
      role="note"
    >
      <span className={styles.label}>
        {illustrative ? TEXT.label[i] : TEXT.labelPrototype[i]}
      </span>
      <span className={styles.text}>
        {illustrative ? TEXT.illustrative[i] : TEXT.prototype[i]}
      </span>
      {router.pathname !== '/experiment' && (
        <Link href="/experiment" className={styles.link}>
          {TEXT.all[i]}
        </Link>
      )}
    </div>
  )
}
