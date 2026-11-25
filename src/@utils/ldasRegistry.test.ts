import { describeMethod, findProvider, parseRegistry } from './ldasRegistry'
import { getVerifiedOwnersFilter } from '../components/Search/utils'

const raw = {
  issuer: 'did:web:id.ldas.jp',
  updated: '2026-11-25T00:00:00Z',
  providers: {
    '0xedAa08237554bBafC218f0EaA86704e1aDe9262E': {
      name: 'A',
      method: ['domain:u-tokyo.ac.jp'],
      selfDeclaredName: false
    },
    notAnAddress: { name: 'x', method: [], selfDeclaredName: true }
  }
}

describe('ldasRegistry', () => {
  test('parseRegistry lower-cases addresses and drops invalid keys', () => {
    const registry = parseRegistry(raw)
    expect(Object.keys(registry.providers)).toEqual([
      '0xedaa08237554bbafc218f0eaa86704e1ade9262e'
    ])
  })

  test('parseRegistry rejects malformed input', () => {
    expect(parseRegistry(null)).toBeUndefined()
    expect(parseRegistry({})).toBeUndefined()
    expect(parseRegistry({ providers: [] })).toBeUndefined()
  })

  test('findProvider is case-insensitive', () => {
    const registry = parseRegistry(raw)
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
