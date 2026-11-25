import {
  describeMethod,
  findProvider,
  isVerificationCurrent,
  parseRegistry
} from './ldasRegistry'
import { getVerifiedOwnersFilter } from './filter'

const raw = {
  issuer: 'did:web:id.ldas.jp',
  updated: '2026-11-25T00:00:00Z',
  providers: {
    '0xedAa08237554bBafC218f0EaA86704e1aDe9262E': {
      name: 'A',
      method: ['domain:u-tokyo.ac.jp'],
      selfDeclaredName: false,
      verifiedAt: '2026-11-20T00:00:00Z'
    },
    '0x1111111111111111111111111111111111111111': {
      name: 'Old',
      method: ['orcid'],
      selfDeclaredName: true,
      verifiedAt: '2024-01-01T00:00:00Z'
    },
    '0x2222222222222222222222222222222222222222': {
      name: 'NoDate',
      method: [],
      selfDeclaredName: true
    },
    notAnAddress: { name: 'x', method: [], selfDeclaredName: true }
  }
}

describe('ldasRegistry', () => {
  test('parseRegistry lower-cases addresses and drops invalid keys', () => {
    const registry = parseRegistry(raw, 365, Date.parse('2026-11-25T00:00:00Z'))
    expect(Object.keys(registry.providers)).toEqual([
      '0xedaa08237554bbafc218f0eaa86704e1ade9262e'
    ])
  })

  test('parseRegistry treats expired or undated entries as unverified', () => {
    const now = Date.parse('2026-11-25T00:00:00Z')
    expect(Object.keys(parseRegistry(raw, 365, now).providers)).toHaveLength(1)
    // a longer max age brings the old entry back; undated never counts
    expect(Object.keys(parseRegistry(raw, 1200, now).providers)).toHaveLength(2)
  })

  test('isVerificationCurrent boundaries', () => {
    const now = Date.parse('2026-11-25T00:00:00Z')
    expect(isVerificationCurrent('2025-11-25T00:00:00Z', 365, now)).toBe(true)
    expect(isVerificationCurrent('2025-11-24T00:00:00Z', 365, now)).toBe(false)
    expect(isVerificationCurrent(undefined, 365, now)).toBe(false)
    expect(isVerificationCurrent('garbage', 365, now)).toBe(false)
  })

  test('parseRegistry rejects malformed input', () => {
    expect(parseRegistry(null)).toBeUndefined()
    expect(parseRegistry({})).toBeUndefined()
    expect(parseRegistry({ providers: [] })).toBeUndefined()
  })

  test('findProvider is case-insensitive', () => {
    const registry = parseRegistry(raw, 365, Date.parse('2026-11-25T00:00:00Z'))
    expect(
      findProvider(
        registry,
        '0XEDAA08237554BBAFC218F0EAA86704E1ADE9262E'.replace('0X', '0x')
      )?.name
    ).toBe('A')
    expect(
      findProvider(registry, '0x1111111111111111111111111111111111111111')
    ).toBeUndefined()
    expect(findProvider(undefined, '0xabc')).toBeUndefined()
  })

  test('describeMethod splits kind and value', () => {
    expect(describeMethod('domain:u-tokyo.ac.jp')).toEqual({
      kind: 'domain',
      value: 'u-tokyo.ac.jp'
    })
    expect(describeMethod('orcid')).toEqual({ kind: 'orcid' })
  })

  test('getVerifiedOwnersFilter matches nothing for an empty list', () => {
    const filter = getVerifiedOwnersFilter([]) as any
    expect(filter.terms['nft.owner']).toEqual([
      '0x0000000000000000000000000000000000000000'
    ])
  })
})
