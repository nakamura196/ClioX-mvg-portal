import { ReactElement, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import Page from '@shared/Page'
import LanguageSwitcher from '@components/Header/LanguageSwitcher'
import ArchivistModeToggle from '@experiment/archivist/Mode/Toggle'
import { useFirstRunTour } from '@experiment/tour/context'
import styles from './IndexPage.module.css'

// [prototype] 試作の一覧（2026-11-25）。/experiment の下のページは、どれも
// Clio-X のポータルの正式な機能ではない。各試作について、何を試したか、
// 何が本物で何が見本（架空）かを 1 か所で示す。
// 区分の根拠: ~/git/web3/reports/2026-11-24-cliox-mock-vs-real/ の点検（コードと画面）。

type Bi = [string, string]
type Item = {
  href: string
  title: Bi
  what: Bi
  real: Bi
  illustrative: Bi
  paper?: Bi
}

const ITEMS: Item[] = [
  {
    href: '/experiment/two-condition',
    title: [
      'Choosing where to run a job (two conditions)',
      'ジョブを動かす場所を選ぶ（2 条件の実験）'
    ],
    what: [
      'A decision exercise: participants compare providers for six jobs, with or without footprint labels. Includes the researcher views (design, receipt).',
      '参加者が 6 つのジョブについて事業者を比べて選ぶ課題です。フットプリントの表示あり・なしの 2 条件があります。研究者向けの画面（設計・明細）も含みます。'
    ],
    real: [
      'The calculation (electricity → facility energy → water → carbon), published emission factors, the receipt fingerprint (SHA-256), and signing/verifying on Sepolia (EAS).',
      '計算（電力 → 施設電力 → 水 → 炭素）、公表された排出係数、明細の指紋（SHA-256）、Sepolia 上の署名と検証（EAS）。'
    ],
    illustrative: [
      'All providers and input values (content/experiment/trials.json), the transaction ID, times, and the telemetry references (demo://…).',
      '事業者と入力値のすべて（content/experiment/trials.json）、取引番号、時刻、測定記録への参照（demo://…）。'
    ],
    paper: [
      'Fig. 2: ?view=receipt&sample=t4a&steps=1',
      '図 2: ?view=receipt&sample=t4a&steps=1'
    ]
  },
  {
    href: '/experiment/paper-fig?env=a',
    title: [
      'Paper figure: comparing compute environments',
      '論文の図: 計算環境を比べる'
    ],
    what: [
      'An asset page built with the real portal components, listing four compute environments side by side.',
      '本物の資料ページと同じ部品で作ったページに、4 つの計算環境を並べたものです。'
    ],
    real: ['The page components and the calculation.', '画面の部品と計算。'],
    illustrative: [
      'The asset, the algorithm, the four providers and every value (same as task t4 of the two-condition exercise).',
      '資料・アルゴリズム・4 つの事業者・すべての値（2 条件の実験の課題 t4 と同じ）。'
    ],
    paper: ['Fig. 1 (?env=a|b|c|d)', '図 1（?env=a|b|c|d）']
  },
  {
    href: '/experiment/carbon-report',
    title: ['Carbon and cost report', '炭素・費用の見積もり報告書'],
    what: [
      'Estimate the energy, carbon and cost of an analysis before running it, and export the estimate.',
      '分析の前に電力・CO2・費用を見積もり、報告書として書き出します。'
    ],
    real: [
      'The calculation; the user can change the conditions.',
      '計算そのもの。条件は利用者が変えられます。'
    ],
    illustrative: [
      'GPU power comes from a fixed table; the defaults (40 jobs × 30 min) are planning assumptions.',
      'GPU の消費電力は固定の表から取ります。初期値（40 件 × 30 分）は計画用の仮定です。'
    ]
  },
  {
    href: '/experiment/carbon-choice',
    title: [
      'Choose where to run, and keep a record',
      '動かす場所を選び、記録を残す'
    ],
    what: [
      'Choose a place to run an analysis and record the choice as a non-transferable token; also the green-fee variants.',
      '分析を動かす場所を選び、その選択を他人に渡せないトークンとして記録します。環境負担金の型もここにあります。'
    ],
    real: [
      'Reads and writes test contracts on Sepolia.',
      'Sepolia 上の試験用の契約に、本当に読み書きします。'
    ],
    illustrative: [
      'The contracts, amounts and places are for testing only.',
      '契約・金額・場所は試験用です。'
    ]
  },
  {
    href: '/experiment/sample-collection',
    title: [
      'Try an analysis on a sample collection',
      'サンプル資料で分析を試す'
    ],
    what: [
      'Run fixity or OCR on eight public-domain page images, without a wallet.',
      'パブリックドメインの画像 8 枚で、固定性の確認や OCR を試せます。ウォレットは要りません。'
    ],
    real: [
      'The images and the stored outputs and logs of a real OCR run.',
      '画像と、実際に行った OCR の結果・記録。'
    ],
    illustrative: [
      'Nothing is sent or spent; results are replayed from that stored run.',
      '外には何も送らず、費用もかかりません。結果は保存した実行の記録を再生しています。'
    ]
  },
  {
    href: '/experiment/archivist-qa',
    title: ['Questions archivists ask', 'アーキビストのための Q&A'],
    what: [
      'Ask about Clio-X in your own words; answers are chosen from prepared text and the InterPARES Trust AI terminology.',
      'Clio-X について、ふだんの言葉で質問できます。答えは、用意した文章と InterPARES Trust AI の用語集から選びます。'
    ],
    real: [
      'The prepared answers and the terminology.',
      '用意した答えと用語集。'
    ],
    illustrative: ['—', '—']
  },
  {
    href: '/experiment/finding-aid/did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c',
    title: [
      'Finding aid view of an asset',
      '資料を目録（finding aid）の形で見る'
    ],
    what: [
      'Shows one asset as an archival finding aid, in the ISAD(G) areas (identity, context, content, access, …), saying for each value whether it comes from the chain or from the publisher. Shown here for the Federalist Papers; open it for any asset from the link at the bottom of its page.',
      '1 つの資料を、ISAD(G) のエリア（識別・コンテクスト・内容・利用条件など）に沿った目録の形で表示します。値ごとに、チェーン由来か提供者の申告かを示します。ここでは Federalist Papers を例に開きます。各資料ページの下のリンクから、どの資料でも開けます。'
    ],
    real: [
      'The asset metadata and its on-chain history (Sepolia).',
      '資料情報と、チェーン上の履歴（Sepolia）。'
    ],
    illustrative: ['—', '—']
  },
  {
    href: '/experiment/apply-provider',
    title: [
      'Verified providers (id.ldas.jp)',
      '認証済みプロバイダー（id.ldas.jp）'
    ],
    what: [
      'Providers who show an id.ldas.jp credential get a "Verified by id.ldas.jp" mark, and the catalogue can be limited to them. This page is where a provider applies.',
      'id.ldas.jp の証明書を提示したプロバイダーに「確認済み」のマークを付け、カタログをその提供者に絞れます。このページは、提供者が申請する画面です。'
    ],
    real: [
      'The credential check (signature, key binding, revocation) and the email to the operator.',
      '証明書の確認（署名・鍵束縛・失効）と、運営者へのメール。'
    ],
    illustrative: [
      'The list of verified providers is filled in by hand by the operator; until then it is empty or a test sample.',
      '認証済みの一覧は運営者が手で書き足します。それまでは空か、試験用の例です。'
    ]
  },
  {
    href: '/experiment/glossary',
    title: [
      'Clio-X words, in archival terms',
      'Clio-X の用語を、アーカイブズの言葉で'
    ],
    what: [
      'Technical words on Clio-X screens, explained through archival practice. Linked from the term tooltips.',
      'Clio-X の画面に出てくる技術用語を、アーカイブズの実務に置き換えて説明します。画面の用語の吹き出しからも開けます。'
    ],
    real: ['The explanations.', '説明の文章。'],
    illustrative: ['—', '—']
  }
]

const L = {
  title: ['Prototypes', '試作の一覧'],
  lead: [
    'These pages are experiments built on the Clio-X portal. They are not part of the production portal. Each entry says what is real and what is illustrative.',
    'Clio-X のポータルの上に作った試作です。ポータルの正式な機能ではありません。それぞれ、何が本物で、何が見本（架空）かを書いています。'
  ],
  what: ['What it tries', '何を試すか'],
  real: ['Real', '本物'],
  illustrative: ['Illustrative', '見本（架空）'],
  paper: ['Paper', '論文'],
  settings: ['Prototype settings', '試作の設定'],
  settingsLead: [
    'These settings stay on for the whole site until you change them here. While one is on, the thin line at the top of every page says so.',
    'ここで変えた設定は、ここで戻すまでサイト全体に残ります。オンの間は、各ページの上端の細い行に表示されます。'
  ],
  language: ['Language', '言語'],
  archivist: ['Archivist view', 'アーキビスト表示'],
  archivistHint: [
    'Hides technical details and explains terms in archival language.',
    '技術的な細部を隠し、用語をアーカイブズの言葉で説明します。'
  ],
  tour: ['Guided tour', '案内ツアー'],
  tourStart: [
    'Start the tour (opens the catalogue)',
    'ツアーを始める（カタログを開きます）'
  ],
  demoTitle: ['Asset pages with ?demo=1', '資料ページに ?demo=1 を付けたとき'],
  demo: [
    'On a real asset page, adding ?demo=1 replaces the compute environments with the four illustrative providers and adds a comparison table (the source of Fig. 1). The asset title, DID and owner are real; the providers and all values are not. A yellow "Illustrative" banner is shown.',
    '本物の資料ページに ?demo=1 を付けると、計算環境が架空の 4 社に替わり、比較表が出ます（図 1 の元）。資料の題名・DID・所有者は本物ですが、事業者と値はすべて架空です。画面の上に黄色の「見本」の帯が出ます。'
  ]
}

export default function PageExperimentIndex(): ReactElement {
  const router = useRouter()
  const { i18n } = useTranslation('common')
  const i = (i18n?.language || 'en').startsWith('ja') ? 1 : 0
  const tour = useFirstRunTour()

  // Old links to the two-condition exercise were /experiment?view=…. The
  // production static export serves /experiment/ before the Worker can
  // redirect, so forward them here as well (next.config.js does it in dev).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (['view', 'condition', 'sample'].some((k) => params.has(k))) {
      router.replace(`/experiment/two-condition?${params.toString()}`)
    }
  }, [router])

  return (
    <Page title={L.title[i]} description={L.lead[i]} uri={router.route}>
      <div className={styles.list}>
        <section className={`${styles.item} ${styles.settings}`}>
          <h2 className={styles.title}>{L.settings[i]}</h2>
          <p className={styles.what}>{L.settingsLead[i]}</p>
          <dl className={styles.grid}>
            <dt>{L.language[i]}</dt>
            <dd>
              <LanguageSwitcher />
            </dd>
            <dt>{L.archivist[i]}</dt>
            <dd>
              <ArchivistModeToggle /> <span>{L.archivistHint[i]}</span>
            </dd>
            <dt>{L.tour[i]}</dt>
            <dd>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  // ツアーは /experiment の下では出さないので、カタログ（トップ）に移ってから始める
                  router.push('/').then(() => tour?.start(0))
                }}
              >
                {L.tourStart[i]}
              </button>
            </dd>
          </dl>
        </section>
        {ITEMS.map((it) => (
          <section key={it.href} className={styles.item}>
            <h2 className={styles.title}>
              <Link href={it.href}>{it.title[i]}</Link>
            </h2>
            <p className={styles.what}>{it.what[i]}</p>
            <dl className={styles.grid}>
              <dt className={styles.real}>{L.real[i]}</dt>
              <dd>{it.real[i]}</dd>
              <dt className={styles.illustrative}>{L.illustrative[i]}</dt>
              <dd>{it.illustrative[i]}</dd>
              {it.paper && (
                <>
                  <dt>{L.paper[i]}</dt>
                  <dd>{it.paper[i]}</dd>
                </>
              )}
            </dl>
          </section>
        ))}
        <section className={styles.item}>
          <h2 className={styles.title}>{L.demoTitle[i]}</h2>
          <p className={styles.what}>{L.demo[i]}</p>
        </section>
      </div>
    </Page>
  )
}
