import type { Locale as DateFnsLocale } from 'date-fns'
import { ja } from 'date-fns/locale'
import useActiveLocale from './useActiveLocale'

/**
 * date-fns の locale オブジェクトを、現在の locale に合わせて返す。
 *
 * `formatDistance` / `formatDuration` は locale を渡さないと必ず英語になるため、
 * 相対時刻 (「16 minutes ago」) や実行時間 (「10 minutes」) がここだけ英語で
 * 残ってしまう。`undefined` を返すと date-fns 既定の en-US が使われる。
 */
export function useDateFnsLocale(): DateFnsLocale | undefined {
  const locale = useActiveLocale()

  return locale === 'ja' ? ja : undefined
}

export default useDateFnsLocale
