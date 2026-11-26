// [local patch] Use-case pages find their algorithm and datasets by DIDs fixed
// per chain in src/components/*/_constants.ts. On our Sepolia trial portal the
// assets get re-published, so let NEXT_PUBLIC_* variables replace the Sepolia
// (11155111) entry without editing code. The site is a static export: values
// are fixed at build time. Each _constants.ts must read process.env.NEXT_PUBLIC_*
// literally, or Next.js will not inline it. See .env.example and the docs page
// developers/usecases.

export const SEPOLIA_CHAIN_ID = 11155111

const DID_PATTERN = /^did:op:[0-9a-f]{64}$/i

/** Splits a comma- or space-separated list; drops entries that are not did:op DIDs. */
export function parseDidList(value: string | undefined): string[] {
  if (!value) return []
  const parts = value.split(/[\s,]+/).filter(Boolean)
  const dids = parts.filter((p) => DID_PATTERN.test(p))
  if (dids.length !== parts.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[useCaseDids] ignored entries that are not did:op DIDs: ${parts
        .filter((p) => !DID_PATTERN.test(p))
        .join(', ')}`
    )
  }
  return dids
}

/** For maps that hold one DID per chain. An empty or unset variable keeps the default. */
export function withSepoliaDid(
  base: Record<number, string>,
  envValue: string | undefined
): Record<number, string> {
  const [did] = parseDidList(envValue)
  return did ? { ...base, [SEPOLIA_CHAIN_ID]: did } : base
}

/** For maps that hold a list of DIDs per chain. An empty or unset variable keeps the default. */
export function withSepoliaDids<T extends Record<number, string | string[]>>(
  base: T,
  envValue: string | undefined
): T {
  const dids = parseDidList(envValue)
  return dids.length ? { ...base, [SEPOLIA_CHAIN_ID]: dids } : base
}
