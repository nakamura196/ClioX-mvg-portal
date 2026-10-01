/**
 * 排出の少ない場所の利用料を安くする試作（型 3 と型 4）。
 * 方針は cliox-docs.ldas.jp/ja/project/green-choice。
 *
 * 型 3（上乗せと値引き）: 排出の多い場所に上乗せし、その分を貯めた「原資」から
 *   排出の少ない場所を値引きする。外からのお金は入れない。原資が無ければ値引きもない。
 * 型 4（補助の預け入れ）: 誰かが預けたお金から、排出の少ない場所の利用料の一部を払う。
 *   割合と 1 件あたりの上限がある。払うたびに台帳に残る。
 *
 * どちらでも、事業者が受け取るのは定価のまま。変わるのは利用者の負担だけ。
 * お金は Sepolia 上の架空の通貨 PLAY（蛇口で誰でも受け取れる。価値は無い）。
 * コントラクトは contracts/carbon-choice/src/GreenFeeDemo.sol。
 * ここの quoteFee は、そのコントラクトの quote と同じ計算をする（画面上の試算用）。
 */

/** Sepolia に配った GreenFeeDemo (2026-10-01, tx 0xc916b30f…) */
export const GREEN_FEE_ADDRESS =
  process.env.NEXT_PUBLIC_GREEN_FEE_ADDRESS ||
  '0xa497eDb2e5B86a223737C66002cb24896AC9c932'
/** 配った区画。台帳から取引を探すときの起点 */
export const GREEN_FEE_DEPLOY_BLOCK = 11821626
/** 誰でも使える既定の仕組み */
export const DEFAULT_SCHEME_ID = 1

const RULES =
  'tuple(uint16 surchargeBps, uint16 discountBps, uint64 lowUpToMgPerHour, uint64 highFromMgPerHour, uint16 subsidyBps, uint64 subsidyCapMicro)'

export const GREEN_FEE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function faucet()',
  'function locationKeys() view returns (string[])',
  'function locations(string) view returns (address provider, uint64 microPerHour, uint64 mgPerHour, bool active)',
  'function schemeCount() view returns (uint256)',
  `function getScheme(uint256) view returns (tuple(address owner, string label, ${RULES} rules, uint256 pool, uint256 deposit, uint256 surchargesIn, uint256 discountsOut, uint256 depositsIn, uint256 subsidiesOut, uint256 withdrawn, uint32 payments))`,
  `function createScheme(string label, ${RULES} rules) returns (uint256)`,
  `function setRules(uint256 schemeId, ${RULES} rules)`,
  'function deposit(uint256 schemeId, uint256 amount)',
  'function withdraw(uint256 schemeId, uint256 amount)',
  'function pay(uint256 schemeId, string key, uint32 durationSeconds, bytes32 ref) returns (uint256)',
  'function paymentsOf(uint256 schemeId) view returns (uint256[])',
  'function getPayment(uint256) view returns (tuple(uint32 schemeId, address payer, uint40 paidAt, uint64 blockNumber, uint32 durationSeconds, uint64 mgCO2e, uint8 band, uint256 base, uint256 surcharge, uint256 discount, uint256 subsidy, uint256 payerPays, bytes32 ref, string locationKey))',
  'event SchemeCreated(uint256 indexed schemeId, address indexed owner, string label)',
  'event Paid(uint256 indexed paymentId, uint256 indexed schemeId, address indexed payer, string locationKey, uint256 base, uint256 surcharge, uint256 discount, uint256 subsidy, uint256 payerPays)',
  'event Deposited(uint256 indexed schemeId, address indexed from, uint256 amount)'
]

/** 金額はすべて PLAY の 100 万分の 1 単位（整数）。1 PLAY = 1 ドル相当の見立て */
export const MICRO = 1_000_000

export interface FeeLocation {
  key: string
  microPerHour: number
  mgPerHour: number
}

export interface FeeRules {
  /** 型 3: 排出の多い場所への上乗せ（1 万分率） */
  surchargeBps: number
  /** 型 3: 排出の少ない場所の値引き（1 万分率）。原資から払う */
  discountBps: number
  /** これ以下（mgCO2e/時）を「少ない」とする */
  lowUpToMgPerHour: number
  /** これ以上（mgCO2e/時）を「多い」とする */
  highFromMgPerHour: number
  /** 型 4: 預け入れから払う割合（1 万分率） */
  subsidyBps: number
  /** 型 4: 1 件あたりの上限（PLAY の 100 万分の 1） */
  subsidyCapMicro: number
}

export interface FeeFunds {
  /** 型 3 の原資 */
  pool: number
  /** 型 4 の預け入れ残高 */
  deposit: number
}

export type Band = 'low' | 'middle' | 'high'
const BANDS: Band[] = ['low', 'middle', 'high']
export const bandFromCode = (n: number): Band => BANDS[n] ?? 'middle'

export interface FeeQuote {
  base: number
  surcharge: number
  discount: number
  /** 決まりどおりならいくら値引きするか。原資が足りないと discount より大きい */
  discountWanted: number
  subsidy: number
  payerPays: number
  mgCO2e: number
  band: Band
}

export const DEFAULT_RULES: FeeRules = {
  surchargeBps: 2000,
  discountBps: 2000,
  lowUpToMgPerHour: 5000,
  highFromMgPerHour: 20000,
  subsidyBps: 5000,
  subsidyCapMicro: 5 * MICRO
}

/** コントラクトの quote と同じ計算（整数の切り捨てまで合わせる） */
export function quoteFee(
  loc: FeeLocation,
  rules: FeeRules,
  funds: FeeFunds,
  durationSeconds: number
): FeeQuote {
  const d = Math.max(0, Math.floor(durationSeconds))
  const base = Math.floor((loc.microPerHour * d) / 3600)
  const mgCO2e = Math.floor((loc.mgPerHour * d) / 3600)
  const band: Band =
    loc.mgPerHour <= rules.lowUpToMgPerHour
      ? 'low'
      : loc.mgPerHour >= rules.highFromMgPerHour
      ? 'high'
      : 'middle'
  const surcharge =
    band === 'high' ? Math.floor((base * rules.surchargeBps) / 10000) : 0
  const discountWanted =
    band === 'low' ? Math.floor((base * rules.discountBps) / 10000) : 0
  const discount = Math.min(discountWanted, Math.max(0, funds.pool))
  const due = base + surcharge - discount
  const subsidy =
    band === 'low'
      ? Math.min(
          Math.floor((due * rules.subsidyBps) / 10000),
          rules.subsidyCapMicro,
          Math.max(0, funds.deposit)
        )
      : 0
  return {
    base,
    surcharge,
    discount,
    discountWanted,
    subsidy,
    payerPays: due - subsidy,
    mgCO2e,
    band
  }
}

export function sameRules(a: FeeRules, b: FeeRules): boolean {
  return (Object.keys(a) as (keyof FeeRules)[]).every((k) => a[k] === b[k])
}

/** "$11.16" の形。PLAY は架空なので、通貨記号の前に置く語は画面側で決める */
export function formatPlay(micro: number): string {
  return (micro / MICRO).toFixed(2)
}

/** g/時 の表示（画面で閾値を入れるときの単位） */
export const mgToG = (mg: number) => mg / 1000
export const gToMg = (g: number) => Math.round(g * 1000)
