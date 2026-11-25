import {
  SortDirectionOptions,
  SortTermOptions
} from '../../@types/aquarius/SearchQuery'
import {
  escapeEsReservedCharacters,
  getFilterTerm,
  generateBaseQuery,
  getWhitelistShould,
  queryStringMatches,
  isServedByCatalogueProvider
} from '.'

const defaultBaseQueryReturn: SearchQuery = {
  from: 0,
  query: {
    bool: {
      filter: [
        { terms: { chainId: [1, 3] } },
        { terms: { _index: ['v510', 'v510'] } }, // v510 is double because two chains are selected
        { term: { 'purgatory.state': false } },
        {
          bool: {
            must_not: [
              { term: { 'nft.state': 5 } },
              { term: { 'price.type': 'pool' } }
            ]
          }
        }
      ]
    }
  },
  size: 1000
}

// add whitelist filtering
if (getWhitelistShould()?.length > 0) {
  const whitelistQuery = {
    bool: {
      should: [...getWhitelistShould()],
      minimum_should_match: 1
    }
  }
  Object.hasOwn(defaultBaseQueryReturn.query.bool, 'must')
    ? defaultBaseQueryReturn.query.bool.must.push(whitelistQuery)
    : (defaultBaseQueryReturn.query.bool.must = [whitelistQuery])
}

describe('@utils/aquarius', () => {
  test('escapeEsReservedCharacters', () => {
    expect(escapeEsReservedCharacters('<')).toBe('\\<')
  })

  test('getFilterTerm with string value', () => {
    expect(getFilterTerm('hello', 'world')).toStrictEqual({
      term: { hello: 'world' }
    })
  })

  test('getFilterTerm with array value', () => {
    expect(getFilterTerm('hello', ['world', 'domination'])).toStrictEqual({
      terms: { hello: ['world', 'domination'] }
    })
  })

  test('generateBaseQuery', () => {
    expect(generateBaseQuery({ chainIds: [1, 3] })).toStrictEqual(
      defaultBaseQueryReturn
    )
  })

  test('generateBaseQuery aggs are passed through', () => {
    expect(
      generateBaseQuery({ chainIds: [1, 3], aggs: 'hello world' })
    ).toStrictEqual({
      ...defaultBaseQueryReturn,
      aggs: 'hello world'
    })
  })

  test('generateBaseQuery sortOptions are passed through', () => {
    expect(
      generateBaseQuery({
        chainIds: [1, 3],
        sortOptions: {
          sortBy: SortTermOptions.Created,
          sortDirection: SortDirectionOptions.Ascending
        }
      })
    ).toStrictEqual({
      ...defaultBaseQueryReturn,
      sort: {
        'nft.created': 'asc'
      }
    })
  })
})

describe('queryStringMatches (search on Ocean Node)', () => {
  const asset = {
    id: 'did:op:8e23',
    metadata: {
      name: '校異源氏物語 きりつぼ（第1帖）',
      description: 'The Kōi Genji monogatari TEI/XML',
      tags: ['genji', 'tei']
    }
  }
  const fields = ['metadata.name^10', 'metadata.description', 'metadata.tags']
  const hit = (query: string) => queryStringMatches(asset, { query, fields })

  test('Japanese substring matches', () => {
    expect(hit('*きりつぼ*')).toBe(true)
    expect(hit('キリツボ')).toBe(true)
    expect(hit('源氏物語')).toBe(true)
  })
  test('all words must match, OR-joined or not', () => {
    expect(hit('genji OR tei')).toBe(true)
    expect(hit('genji OR cameroon')).toBe(false)
    expect(hit('*はしひめ*')).toBe(false)
  })
  test('escaped and wildcard-only queries', () => {
    expect(hit('TEI\\/XML*')).toBe(true)
    expect(hit('**')).toBe(true)
  })
})

describe('isServedByCatalogueProvider', () => {
  const node = 'https://cliox-node.ldas.jp'
  const asset = (...endpoints: string[]) =>
    ({
      services: endpoints.map((serviceEndpoint) => ({ serviceEndpoint }))
    } as any)

  it('keeps assets served by a listed provider', () => {
    expect(isServedByCatalogueProvider(asset(node), [node])).toBe(true)
    expect(isServedByCatalogueProvider(asset(`${node}/`), [node])).toBe(true)
  })
  it('drops assets served from elsewhere or from a local machine', () => {
    expect(
      isServedByCatalogueProvider(asset('http://127.0.0.1:8001'), [node])
    ).toBe(false)
    expect(isServedByCatalogueProvider(asset(node, 'ipfs://x'), [node])).toBe(
      false
    )
    expect(isServedByCatalogueProvider(asset(), [node])).toBe(false)
  })
  it('does not filter when the list is empty or *', () => {
    expect(
      isServedByCatalogueProvider(asset('http://127.0.0.1:8001'), [])
    ).toBe(true)
    expect(
      isServedByCatalogueProvider(asset('http://127.0.0.1:8001'), ['*'])
    ).toBe(true)
  })
})
