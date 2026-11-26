// [local patch] Tests for useCaseDids.ts.
import {
  parseDidList,
  withSepoliaDid,
  withSepoliaDids,
  SEPOLIA_CHAIN_ID
} from './useCaseDids'

const A = 'did:op:' + 'a'.repeat(64)
const B = 'did:op:' + 'b'.repeat(64)
const C = 'did:op:' + 'c'.repeat(64)

describe('useCaseDids', () => {
  it('parses comma and space separated lists', () => {
    expect(parseDidList(` ${A}, ${B}\n`)).toEqual([A, B])
    expect(parseDidList('')).toEqual([])
    expect(parseDidList(undefined)).toEqual([])
  })

  it('drops entries that are not did:op DIDs', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseDidList(`${A},did:op:123,xyz`)).toEqual([A])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('keeps the defaults when the variable is unset', () => {
    const base = { 32456: A, [SEPOLIA_CHAIN_ID]: B }
    expect(withSepoliaDid(base, undefined)).toBe(base)
    const list = { 32456: [A], [SEPOLIA_CHAIN_ID]: [B] }
    expect(withSepoliaDids(list, '')).toBe(list)
  })

  it('replaces only the Sepolia entry', () => {
    expect(withSepoliaDid({ 32456: A }, `${C},${B}`)).toEqual({
      32456: A,
      [SEPOLIA_CHAIN_ID]: C
    })
    expect(withSepoliaDids({ 32456: [A], [SEPOLIA_CHAIN_ID]: [B] }, C)).toEqual(
      { 32456: [A], [SEPOLIA_CHAIN_ID]: [C] }
    )
  })
})
