/**
 * Deep-merges a sparse locale override on top of the English content JSON in
 * `content/`.
 *
 * Objects are merged key by key and **arrays are merged by index**, so a
 * translation file only has to carry the strings that actually change:
 *
 *   en: { menu: [{ name: 'Catalogue', link: '/search' }, ...] }
 *   ja: { menu: [{ name: 'カタログ' }, ...] }
 *   -> { menu: [{ name: 'カタログ', link: '/search' }, ...] }
 *
 * Index-based array merging keeps links, images and other structure in a single
 * place, at the cost of a coupling to element order: if upstream reorders
 * `content/site.json`'s menu, `content/site.ja.json` has to be reordered too.
 * `null` in an override means "keep the English value" so gaps can be left in
 * the middle of an array.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mergeLocaleContent<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return base

  if (Array.isArray(base) && Array.isArray(override)) {
    return base.map((item, index) =>
      index < override.length ? mergeLocaleContent(item, override[index]) : item
    ) as unknown as T
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = { ...base }
    for (const key of Object.keys(override)) {
      merged[key] = mergeLocaleContent(
        (base as Record<string, unknown>)[key],
        override[key]
      )
    }
    return merged as unknown as T
  }

  return override as T
}

export default mergeLocaleContent
