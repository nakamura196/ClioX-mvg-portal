import { Asset, LoggerInstance } from '@oceanprotocol/lib'
import { AssetSelectionAsset } from '@shared/FormInput/InputElement/AssetSelection'
import axios, { CancelToken, AxiosResponse } from 'axios'
import { OrdersData_orders as OrdersData } from '../../@types/subgraph/OrdersData'
import {
  metadataCacheUri,
  metadataCacheIsOceanNode,
  allowDynamicPricing
} from '../../../app.config'
import {
  FilterByTypeOptions,
  SortDirectionOptions,
  SortTermOptions
} from '../../@types/aquarius/SearchQuery'
import { transformAssetToAssetSelection } from '../assetConvertor'
import addressConfig from '../../../address.config'
import { isValidDid } from '@utils/ddo'
import { getTokenSymbol } from '@utils/tokenSymbol'
import { Filters } from '@context/Filter'
import { filterSets } from '@components/Search/Filter'
import { CHAIN_TO_INDEX_MAP, DEFAULT_INDEX } from './_constants'

export interface UserSales {
  id: string
  totalSales: number
}

export const MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS = 476

const saasFieldExists = {
  exists: {
    field: 'metadata.additionalInformation.saas.redirectUrl'
  }
}

export function escapeEsReservedCharacters(value: string): string {
  // eslint-disable-next-line no-useless-escape
  const pattern = /([\!\*\+\-\=\<\>\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g
  return value?.replace(pattern, '\\$1')
}

/**
 * @param filterField the name of the actual field from the ddo schema e.g. 'id','service.attributes.main.type'
 * @param value the value of the filter
 * @returns json structure of the es filter
 */
type TFilterValue = string | number | boolean | number[] | string[]
type TFilterKey = 'terms' | 'term' | 'match' | 'match_phrase'

export function getFilterTerm(
  filterField: string,
  value: TFilterValue,
  key: TFilterKey = 'term'
): FilterTerm {
  const isArray = Array.isArray(value)
  const useKey = key === 'term' ? (isArray ? 'terms' : 'term') : key
  return {
    [useKey]: {
      [filterField]: value
    }
  }
}

export function parseFilters(
  filtersList: Filters,
  filterSets: { [key: string]: string[] }
): FilterTerm[] {
  const filterQueryPath = {
    accessType: 'services.type',
    serviceType: 'metadata.type',
    filterSet: 'metadata.tags.keyword'
  }

  const filterTerms = Object.keys(filtersList)?.map((key) => {
    if (key === 'filterSet') {
      const tags = filtersList[key].reduce(
        (acc, set) => [...acc, ...filterSets[set]],
        []
      )
      const uniqueTags = [...new Set(tags)]
      return uniqueTags.length > 0
        ? getFilterTerm(filterQueryPath[key], uniqueTags)
        : undefined
    }
    if (filtersList[key].length > 0)
      return getFilterTerm(filterQueryPath[key], filtersList[key])

    return undefined
  })

  return filterTerms.filter((term) => term !== undefined)
}

export function getWhitelistShould(): FilterTerm[] {
  const { whitelists } = addressConfig

  const whitelistFilterTerms = Object.entries(whitelists)
    .filter(([field, whitelist]) => whitelist.length > 0)
    .map(([field, whitelist]) =>
      whitelist.map((address) => getFilterTerm(field, address, 'match'))
    )
    .reduce((prev, cur) => prev.concat(cur), [])

  return whitelistFilterTerms.length > 0 ? whitelistFilterTerms : []
}

export function getDynamicPricingMustNot(): // eslint-disable-next-line camelcase
FilterTerm | undefined {
  return allowDynamicPricing === 'true'
    ? undefined
    : getFilterTerm('price.type', 'pool')
}

export function getIndexForChainIds(chainIds: number[]): string[] {
  const indexes: string[] = []
  for (const chainId of chainIds) {
    const index = CHAIN_TO_INDEX_MAP[chainId] || DEFAULT_INDEX
    indexes.push(index)
  }
  return indexes
}

export function generateBaseQuery(
  baseQueryParams: BaseQueryParams
): SearchQuery {
  const isMetadataTypeSelected = !!baseQueryParams?.filters?.find((e) =>
    Object.hasOwn(e, 'term')
      ? Object.keys(e?.term)?.includes('metadata.type')
      : Object.hasOwn(e, 'terms')
      ? Object.keys(e?.terms)?.includes('metadata.type')
      : false
  )

  const generatedQuery = {
    from: baseQueryParams.esPaginationOptions?.from || 0,
    size:
      baseQueryParams.esPaginationOptions?.size >= 0
        ? baseQueryParams.esPaginationOptions?.size
        : 1000,
    query: {
      bool: {
        ...baseQueryParams.nestedQuery,
        filter: [
          ...(baseQueryParams.filters || []),
          ...(baseQueryParams.chainIds
            ? [getFilterTerm('chainId', baseQueryParams.chainIds)]
            : []),
          // [local patch] `_index` は Elasticsearch 固有のフィルタ。Ocean Node は
          // Typesense で `op_ddo_v<DDOのversion>` というコレクションに分けて持つため、
          // 'v510' で絞ると常に 0 件になる。Ocean Node 構成では外す。
          ...(metadataCacheIsOceanNode
            ? []
            : [
                getFilterTerm(
                  '_index',
                  getIndexForChainIds(baseQueryParams.chainIds)
                )
              ]),
          ...(baseQueryParams.ignorePurgatory
            ? []
            : [getFilterTerm('purgatory.state', false)]),
          ...(!isMetadataTypeSelected && baseQueryParams.showSaas
            ? [saasFieldExists]
            : []),
          {
            bool: {
              must_not: [
                ...(!baseQueryParams.ignoreState
                  ? [getFilterTerm('nft.state', 5)]
                  : []),
                getDynamicPricingMustNot(),
                ...(baseQueryParams.showSaas === false && isMetadataTypeSelected
                  ? [saasFieldExists]
                  : [])
              ]
            }
          }
        ]
      }
    }
  } as SearchQuery

  if (baseQueryParams.aggs !== undefined) {
    generatedQuery.aggs = baseQueryParams.aggs
  }

  if (baseQueryParams.sortOptions !== undefined)
    generatedQuery.sort = {
      [baseQueryParams.sortOptions.sortBy]:
        baseQueryParams.sortOptions.sortDirection ||
        SortDirectionOptions.Descending
    }

  // add whitelist filtering
  if (getWhitelistShould()?.length > 0) {
    const whitelistQuery = {
      bool: {
        should: [...getWhitelistShould()],
        minimum_should_match: 1
      }
    }
    Object.hasOwn(generatedQuery.query.bool, 'must')
      ? generatedQuery.query.bool.must.push(whitelistQuery)
      : (generatedQuery.query.bool.must = [whitelistQuery])
  }

  // if the selected type filter includes both algo and saas, we need to inject the
  // dataset type to the filter, otherwise saas assets will not show up
  if (baseQueryParams.showSaas && isMetadataTypeSelected) {
    const metadataTypeFilter = baseQueryParams?.filters?.find(
      (e) =>
        (Object.hasOwn(e, 'term') &&
          Object.keys(e.term)?.includes('metadata.type')) ||
        (Object.hasOwn(e, 'terms') &&
          Object.keys(e.terms)?.includes('metadata.type'))
    )
    const metadataSelected = Object.hasOwn(metadataTypeFilter, 'term')
      ? ([metadataTypeFilter?.term?.['metadata.type']] as string[])
      : (metadataTypeFilter?.terms?.['metadata.type'] as string[])

    if (
      metadataSelected?.length === 1 &&
      metadataSelected.includes(FilterByTypeOptions.Algorithm)
    ) {
      const dataTypeIndex = generatedQuery.query.bool.filter.findIndex(
        (filter) => Object.keys(filter?.terms)?.includes('metadata.type')
      )

      // push dataset type to 'metadata.type' filter
      generatedQuery.query.bool.filter[dataTypeIndex].terms[
        'metadata.type'
      ].push(FilterByTypeOptions.Data)

      // only allow for either 'metadata.type' === 'algorithm' or saasFieldExists
      generatedQuery.query.bool.must.push({
        bool: {
          should: [
            getFilterTerm('metadata.type', FilterByTypeOptions.Algorithm),
            saasFieldExists
          ],
          minimum_should_match: 1
        }
      })
    }
  }

  return generatedQuery
}

// [local patch] Ocean Node と Aquarius(Elasticsearch) の DDO 形状差を吸収する。
//
//   Aquarius   : { …, nft: {...}, stats: { orders, allocated, price }, purgatory: {...} }
//   Ocean Node : { …, indexedMetadata: { nft, stats, purgatory, event } }
//                 かつ stats は datatoken ごとの配列
//
// ポータルの各所（AssetTeaser / Asset.tsx など）はトップレベルの nft・stats を
// 参照するため、ここで詰め替える。Aquarius 由来のデータはそのまま通す。
export function normalizeOceanNodeAsset(input: any): Asset {
  if (!input) return input
  const doc = { ...input }
  const im = doc.indexedMetadata || {}
  if (!doc.indexedMetadata) return doc as Asset

  const rawStats = doc.stats || im.stats
  const stats = Array.isArray(rawStats)
    ? {
        orders: rawStats.reduce(
          (n: number, x: any) => n + (Number(x?.orders) || 0),
          0
        ),
        allocated: 0,
        price: {
          value: Number(rawStats?.[0]?.prices?.[0]?.price) || 0,
          // token はアドレス。記号は chains.config.js から引く
          tokenSymbol: getTokenSymbol(
            doc.chainId,
            rawStats?.[0]?.prices?.[0]?.token
          ),
          tokenAddress: rawStats?.[0]?.prices?.[0]?.token || undefined
        }
      }
    : rawStats || { orders: 0, allocated: 0, price: { value: 0 } }

  return {
    ...doc,
    // stats / purgatory には既定値があるのに nft だけ無く、Ocean Node 由来の
    // 文書では asset.nft が undefined になる。AssetTeaser や EditHistory など
    // 各所が asset.nft.xxx を直接読むため、ここが多くのクラッシュの源になる。
    nft: doc.nft || im.nft || { owner: '', state: 0, address: '', created: '' },
    stats,
    purgatory: doc.purgatory || im.purgatory || { state: false },
    event: doc.event || im.event
  } as Asset
}

export function transformQueryResult(
  queryResult: SearchResponse,
  from = 0,
  size = 21
): PagedAssets {
  const result: PagedAssets = {
    results: [],
    page: 0,
    totalPages: 0,
    totalResults: 0,
    aggregations: []
  }

  // [local patch] Ocean Node(Typesense) と Aquarius(Elasticsearch) で応答形式が違う。
  //
  //   Aquarius   : { hits: { hits: [{ _source: DDO }], total: { value } } }
  //   Ocean Node : [ { request_params: { collection_name }, found, hits: [{ document: DDO }] }, … ]
  //                 ← DDO の version ごとのコレクション(op_ddo_v4.1.0 等)を個別に検索した
  //                    結果が、コレクションの数だけ並んで返る
  //
  // Ocean Node 形式なら、全コレクションの hits を 1 本に平坦化する。
  if (Array.isArray(queryResult as unknown)) {
    const collections = queryResult as unknown as any[]
    const hits = collections.flatMap((c) => c?.hits || [])
    // Ocean Node は nft / stats / purgatory / event を indexedMetadata の下に入れる。
    // ポータルの各コンポーネント（AssetTeaser 等）はトップレベルを参照するので持ち上げる。
    result.results = hits.map((h) => {
      return normalizeOceanNodeAsset(h.document || h._source || h)
    })
    result.aggregations = []
    result.totalResults = collections.reduce(
      (sum, c) => sum + (Number(c?.found) || 0),
      0
    )
  } else {
    result.results = (queryResult.hits.hits || []).map(
      (hit) => hit._source as Asset
    )

    result.aggregations = queryResult.aggregations
    // Temporary fix to handle old Aquarius deployment
    result.totalResults =
      queryResult.hits.total?.value ||
      (queryResult.hits.total as unknown as number)
  }

  result.totalPages =
    result.totalResults / size < 1
      ? Math.floor(result.totalResults / size)
      : Math.ceil(result.totalResults / size)
  result.page = from ? from / size + 1 : 1

  return result
}

/**
 * [local patch] Elasticsearch のクエリを、取得済みの資産に対して手元で評価する。
 *
 * ローカルの Ocean Node は ES 形式の filter を解釈できないため、絞り込みを外して
 * 全件取得したうえでここで同じ条件を適用する。対応するのはポータルが実際に使う
 * 範囲（term / terms / match / bool の filter・must・should・must_not）に限る。
 */
function esFieldValues(asset: any, field: string): any[] {
  // 'metadata.type' のようなドット記法をたどる。'_id' は DID を指す。
  // Elasticsearch と同じく、途中に配列があれば全要素をたどり、値を平らに集める
  // （'services.type' は services[] のどれか 1 つが一致すればよい）。
  // 'metadata.tags.keyword' の '.keyword' は ES の索引の種類なので外す。
  if (field === '_id' || field === 'id') return [asset?.id]
  const keys = field.replace(/\.keyword$/, '').split('.')
  let values: any[] = [asset]
  for (const k of keys) {
    values = values
      .flatMap((o) => (Array.isArray(o) ? o : [o]))
      .map((o) => (o == null ? undefined : o[k]))
      .filter((v) => v != null)
  }
  return values.flatMap((v) => (Array.isArray(v) ? v : [v]))
}

// 全角・半角、大文字・小文字、カタカナ・ひらがなの違いを無視して比べる
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

// query_string を「語がすべて、どれかの欄に含まれる」で判定する。
// 語は空白と OR で区切る。日本語は分かち書きしないので部分一致にする。
export function queryStringMatches(
  asset: any,
  qs: { query: string; fields?: string[] }
): boolean {
  const words = String(qs.query)
    .replace(/\\(.)/g, '$1')
    .split(/\s+OR\s+|\s+/)
    .map((w) => normalizeForSearch(w.replace(/\*/g, '')))
    .filter((w) => w !== '')
  if (words.length === 0) return true
  const fields = (qs.fields || []).map((f) => f.replace(/\^.*$/, ''))
  const haystack = fields
    .flatMap((f) => esFieldValues(asset, f))
    .map((v) => normalizeForSearch(String(v)))
    .join('\n')
  return words.every((w) => haystack.includes(w))
}

function esClauseMatches(asset: any, clause: any): boolean {
  if (!clause || typeof clause !== 'object') return true

  if (clause.bool) {
    const b = clause.bool
    const all = (list: any) =>
      !list ||
      (Array.isArray(list) ? list : [list]).every((c) =>
        esClauseMatches(asset, c)
      )
    const any = (list: any) => {
      if (!list) return true
      const arr = Array.isArray(list) ? list : [list]
      return arr.length === 0 || arr.some((c) => esClauseMatches(asset, c))
    }
    const none = (list: any) =>
      !list ||
      !(Array.isArray(list) ? list : [list]).some((c) =>
        esClauseMatches(asset, c)
      )
    return all(b.filter) && all(b.must) && any(b.should) && none(b.must_not)
  }

  const cmp = (a: any, b: any) =>
    String(a).toLowerCase() === String(b).toLowerCase()

  for (const kind of ['term', 'match', 'match_phrase']) {
    if (clause[kind]) {
      const [field, raw] = Object.entries(clause[kind])[0] as [string, any]
      const want = raw?.value ?? raw?.query ?? raw
      return esFieldValues(asset, field).some((v) => cmp(v, want))
    }
  }
  if (clause.terms) {
    const [field, raw] = Object.entries(clause.terms)[0] as [string, any]
    const list = Array.isArray(raw) ? raw : [raw]
    // terms が空 = 条件なし（絞り込まない）
    if (list.length === 0) return true
    const values = esFieldValues(asset, field)
    return values.some((v) => list.some((w) => cmp(v, w)))
  }
  if (clause.exists?.field) {
    return esFieldValues(asset, clause.exists.field).length > 0
  }
  // 検索語。Ocean Node は日本語を含め全文検索を正しく扱えないので、
  // 以前はここも素通しになっていて、何を入れても全件が出ていた。
  if (clause.query_string?.query !== undefined) {
    return queryStringMatches(asset, clause.query_string)
  }
  // 未対応の節（range 等）は素通しにする。
  // 落として全件消すより、多めに返して表示側で弾く方が安全。
  return true
}

function matchesEsQuery(asset: any, query: any): boolean {
  if (!query) return true
  return esClauseMatches(asset, query)
}

export async function queryMetadata(
  query: SearchQuery,
  cancelToken: CancelToken
): Promise<PagedAssets> {
  try {
    // [local patch] Ocean Node は query.bool.filter に terms/term を入れると
    // 空配列を返す（Typesense へのフィルタ変換が Elasticsearch 形式に追随していない）。
    // ローカル構成では絞り込みを外して取得し、**同じ条件を手元で適用する**。
    //
    // 【重要】ここで chainId だけしか適用しないと、「このデータセットが信頼する
    // アルゴリズム一覧」のような問い合わせまで全件返ってしまい、アルゴリズムの
    // 選択欄にデータセットが並ぶ（実際に踏んだ）。落とした条件は必ず手元で戻すこと。
    const isLocalNode = metadataCacheIsOceanNode

    const response: AxiosResponse<SearchResponse> = await axios.post(
      `${metadataCacheUri}/api/aquarius/assets/metadata/query`,
      isLocalNode ? { query: { bool: { filter: [] } } } : { ...query },
      { cancelToken }
    )
    if (!response || response.status !== 200 || !response.data) return

    const transformed = transformQueryResult(
      response.data,
      query.from,
      query.size
    )
    if (isLocalNode && transformed?.results) {
      transformed.results = transformed.results.filter((a) =>
        matchesEsQuery(a, (query as any)?.query)
      )
      transformed.totalResults = transformed.results.length
      // 絞り込んだ後の件数でページ数を数え直す（全件のままだと空のページが出る）
      const size = query.size || 21
      transformed.totalPages = Math.ceil(transformed.totalResults / size)
    }
    return transformed
  } catch (error) {
    if (axios.isCancel(error)) {
      LoggerInstance.log(error.message)
    } else {
      LoggerInstance.error(error.message)
    }
  }
}

export async function getAsset(
  did: string,
  cancelToken: CancelToken
): Promise<Asset> {
  try {
    if (!isValidDid(did)) return

    const response: AxiosResponse<Asset> = await axios.get(
      `${metadataCacheUri}/api/aquarius/assets/ddo/${did}`,
      { cancelToken }
    )
    if (!response || response.status !== 200 || !response.data) return

    // [local patch] Ocean Node 形式なら nft / stats をトップレベルへ持ち上げる
    return normalizeOceanNodeAsset({ ...response.data })
  } catch (error) {
    if (axios.isCancel(error)) {
      LoggerInstance.log(error.message)
    } else {
      LoggerInstance.error(error.message)
    }
  }
}

export async function getAssetsNames(
  didList: string[],
  cancelToken: CancelToken
): Promise<Record<string, string>> {
  try {
    const response: AxiosResponse<Record<string, string>> = await axios.post(
      `${metadataCacheUri}/api/aquarius/assets/names`,
      { didList },
      { cancelToken }
    )
    if (!response || response.status !== 200 || !response.data) return
    return response.data
  } catch (error) {
    if (axios.isCancel(error)) {
      LoggerInstance.log(error.message)
    } else {
      LoggerInstance.error(error.message)
    }
  }
}

export async function getAssetsFromDids(
  didList: string[],
  chainIds: number[],
  cancelToken: CancelToken
): Promise<Asset[]> {
  if (didList?.length === 0 || chainIds?.length === 0) return []

  try {
    const orderedDDOListByDIDList: Asset[] = []
    const baseQueryparams = {
      chainIds,
      filters: [getFilterTerm('_id', didList)],
      ignorePurgatory: true
    } as BaseQueryParams
    const query = generateBaseQuery(baseQueryparams)
    const result = await queryMetadata(query, cancelToken)

    // queryMetadata は非200・空・キャンセル・例外のとき undefined を返す設計。
    // result.results を直接辿ると TypeError になるので optional で読む。
    didList.forEach((did: string) => {
      const ddo = result?.results?.find((ddo: Asset) => ddo.id === did)
      if (ddo) orderedDDOListByDIDList.push(ddo)
    })
    return orderedDDOListByDIDList
  } catch (error) {
    LoggerInstance.error(error.message)
  }
}

export async function getAlgorithmDatasetsForCompute(
  algorithmId: string,
  datasetProviderUri: string,
  accountId: string,
  datasetChainId?: number,
  cancelToken?: CancelToken
): Promise<AssetSelectionAsset[]> {
  const baseQueryParams = {
    chainIds: [datasetChainId],
    nestedQuery: {
      must: [
        {
          // A dataset that trusts "*" accepts every algorithm (see getQueryString)
          bool: {
            should: [algorithmId, '*'].map((did) => ({
              match_phrase: {
                'services.compute.publisherTrustedAlgorithms.did': {
                  query: did
                }
              }
            }))
          }
        }
      ]
    },
    sortOptions: {
      sortBy: SortTermOptions.Created,
      sortDirection: SortDirectionOptions.Descending
    }
  } as BaseQueryParams

  const query = generateBaseQuery(baseQueryParams)
  const computeDatasets = await queryMetadata(query, cancelToken)
  // `?.length === 0` では queryMetadata が返す undefined を弾けず、
  // 直後の computeDatasets.results で落ちる。長さの真偽値で判定する。
  if (!computeDatasets?.results?.length) return []

  const datasets = await transformAssetToAssetSelection(
    datasetProviderUri,
    computeDatasets.results,
    accountId,
    []
  )
  return datasets
}

export async function getPublishedAssets(
  accountId: string,
  chainIds: number[],
  cancelToken: CancelToken,
  ignorePurgatory = false,
  ignoreState = false,
  filtersList?: Filters,
  page?: number
): Promise<PagedAssets> {
  if (!accountId) return

  const filters: FilterTerm[] = []

  filters.push(getFilterTerm('nft.state', [0, 4, 5]))
  filters.push(getFilterTerm('nft.owner', accountId.toLowerCase()))

  const showSaas = filtersList?.serviceType?.includes(FilterByTypeOptions.Saas)

  // we make sure to query only for service types that are expected
  // by Aqua ("dataset" or "algorithm") by removing "saas"
  const sanitizedFilters: Filters = filtersList
    ? {
        ...filtersList,
        serviceType: (filtersList.serviceType || []).filter(
          (type) => type !== FilterByTypeOptions.Saas
        )
      }
    : ({} as Filters)

  parseFilters(sanitizedFilters, filterSets).forEach((term) =>
    filters.push(term)
  )

  const baseQueryParams = {
    chainIds,
    filters,
    sortOptions: {
      sortBy: SortTermOptions.Created,
      sortDirection: SortDirectionOptions.Descending
    },
    aggs: {
      totalOrders: {
        sum: {
          field: SortTermOptions.Orders
        }
      }
    },
    ignorePurgatory,
    ignoreState,
    esPaginationOptions: {
      from: (Number(page) - 1 || 0) * 9,
      size: 9
    },
    showSaas
  } as BaseQueryParams

  const query = generateBaseQuery(baseQueryParams)

  try {
    const result = await queryMetadata(query, cancelToken)
    return result
  } catch (error) {
    if (axios.isCancel(error)) {
      LoggerInstance.log(error.message)
    } else {
      LoggerInstance.error(error.message)
    }
  }
}

async function getTopPublishers(
  chainIds: number[],
  cancelToken: CancelToken,
  page?: number,
  type?: string,
  accesType?: string
): Promise<PagedAssets> {
  const filters: FilterTerm[] = []

  accesType !== undefined &&
    filters.push(getFilterTerm('services.type', accesType))
  type !== undefined && filters.push(getFilterTerm('metadata.type', type))

  const baseQueryParams = {
    chainIds,
    filters,
    sortOptions: {
      sortBy: SortTermOptions.Created,
      sortDirection: SortDirectionOptions.Descending
    },
    aggs: {
      topPublishers: {
        terms: {
          field: 'nft.owner.keyword',
          order: { totalSales: 'desc' }
        },
        aggs: {
          totalSales: {
            sum: {
              field: SortTermOptions.Orders
            }
          }
        }
      }
    },
    esPaginationOptions: {
      from: (Number(page) - 1 || 0) * 9,
      size: 9
    }
  } as BaseQueryParams

  const query = generateBaseQuery(baseQueryParams)

  try {
    const result = await queryMetadata(query, cancelToken)
    return result
  } catch (error) {
    if (axios.isCancel(error)) {
      LoggerInstance.log(error.message)
    } else {
      LoggerInstance.error(error.message)
    }
  }
}

export async function getTopAssetsPublishers(
  chainIds: number[],
  nrItems = 9
): Promise<UserSales[]> {
  const publishers: UserSales[] = []

  const result = await getTopPublishers(chainIds, null)
  const { topPublishers } = result.aggregations

  for (let i = 0; i < topPublishers.buckets.length; i++) {
    publishers.push({
      id: topPublishers.buckets[i].key,
      totalSales: parseInt(topPublishers.buckets[i].totalSales.value)
    })
  }

  publishers.sort((a, b) => b.totalSales - a.totalSales)

  return publishers.slice(0, nrItems)
}

export async function getUserSales(
  accountId: string,
  chainIds: number[]
): Promise<number> {
  try {
    const result = await getPublishedAssets(accountId, chainIds, null)
    const { totalOrders } = result.aggregations
    return totalOrders.value
  } catch (error) {
    LoggerInstance.error('Error getUserSales', error.message)
  }
}

export async function getDownloadAssets(
  dtList: string[],
  tokenOrders: OrdersData[],
  chainIds: number[],
  cancelToken: CancelToken,
  ignoreState = false
): Promise<DownloadedAsset[]> {
  const baseQueryparams = {
    chainIds,
    filters: [
      getFilterTerm('services.datatokenAddress', dtList),
      getFilterTerm('services.type', 'access')
    ],
    ignorePurgatory: true,
    ignoreState
  } as BaseQueryParams
  const query = generateBaseQuery(baseQueryparams)
  try {
    const result = await queryMetadata(query, cancelToken)
    // queryMetadata は非200・空・キャンセル時に undefined を返すため、
    // result.results をそのまま map すると履歴タブごと落ちる。
    const downloadedAssets: DownloadedAsset[] = (result?.results || [])
      .map((asset) => {
        const order = tokenOrders.find(
          ({ datatoken }) =>
            datatoken?.address.toLowerCase() ===
            asset.services[0].datatokenAddress.toLowerCase()
        )

        return {
          asset,
          networkId: asset.chainId,
          dtSymbol: order?.datatoken?.symbol,
          timestamp: order?.createdTimestamp
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)

    return downloadedAssets
  } catch (error) {
    if (axios.isCancel(error)) {
      LoggerInstance.log(error.message)
    } else {
      LoggerInstance.error(error.message)
    }
  }
}

export async function getTagsList(
  chainIds: number[],
  cancelToken: CancelToken
): Promise<string[]> {
  // 集計に頼れないローカル構成では、件数 0 だと手元で集めるものが無くなる。
  const isLocalNode = metadataCacheIsOceanNode
  const baseQueryParams = {
    chainIds,
    esPaginationOptions: { from: 0, size: isLocalNode ? 1000 : 0 }
  } as BaseQueryParams
  const query = {
    ...generateBaseQuery(baseQueryParams),
    aggs: {
      tags: {
        terms: {
          field: 'metadata.tags.keyword',
          size: 1000
        }
      }
    }
  }

  try {
    const response: AxiosResponse<SearchResponse> = await axios.post(
      `${metadataCacheUri}/api/aquarius/assets/metadata/query`,
      { ...query },
      { cancelToken }
    )
    if (response?.status !== 200 || !response?.data) return

    // [local patch] Ocean Node は Elasticsearch の aggregations を返さない。
    // 集計できないので、取得した資産から手元でタグを集める。
    if (!response.data.aggregations?.tags) {
      const hits: any[] = (response.data as any)?.hits?.hits || []
      const tags = hits
        .map((h) => h?._source?.metadata?.tags || h?.metadata?.tags || [])
        .flat()
        .filter((t: string) => t && t !== '')
      return Array.from(new Set<string>(tags)).sort()
    }

    const { buckets }: { buckets: AggregatedTag[] } =
      response.data.aggregations.tags

    const tagsList = buckets
      .filter((tag) => tag.key !== '')
      .map((tag) => tag.key)

    return tagsList.sort()
  } catch (error) {
    if (axios.isCancel(error)) {
      LoggerInstance.log(error.message)
    } else {
      LoggerInstance.error(error.message)
    }
  }
}
