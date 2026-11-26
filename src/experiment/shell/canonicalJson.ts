/**
 * 正規化した JSON(canonical JSON)と、そのハッシュ。
 *
 * 規則は RFC 8785 (JSON Canonicalization Scheme, JCS) に従う。
 *   - 空白を入れない
 *   - オブジェクトのキーを UTF-16 コード単位の昇順に並べる
 *   - 数値は ECMAScript の Number 表記(JSON.stringify と同じ)。NaN と Infinity は拒否
 *   - 文字列は JSON.stringify の出力(JCS と同じエスケープ)
 *   - 値が undefined のキーは捨てる。配列の中の undefined は null にする(JSON.stringify と同じ)
 * 数値は JavaScript の倍精度(IEEE 754)で表せるものだけを扱う。
 * 追加の依存は使わない。
 */
import { utils } from 'ethers'

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false'
    case 'string':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error('canonicalJson: NaN and Infinity cannot be serialized')
      }
      // -0 は JCS でも "0"
      return JSON.stringify(Object.is(value, -0) ? 0 : value)
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value
          .map((v) => (v === undefined ? 'null' : canonicalJson(v)))
          .join(',')}]`
      }
      const obj = value as Record<string, unknown>
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort()
      return `{${keys
        .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
        .join(',')}}`
    }
    default:
      throw new Error(`canonicalJson: unsupported type ${typeof value}`)
  }
}

/** 文字列(UTF-8)の SHA-256 を、0x 付きの 16 進で返す。同期。 */
export function sha256OfText(text: string): string {
  return utils.sha256(utils.toUtf8Bytes(text))
}

/** 値を正規化した JSON にして SHA-256 を取る。0x 付きの 16 進 */
export function canonicalSha256(value: unknown): string {
  return sha256OfText(canonicalJson(value))
}

/** 0x を除いた 64 桁の 16 進(画面表示用) */
export const stripHexPrefix = (h: string): string => h.replace(/^0x/, '')
