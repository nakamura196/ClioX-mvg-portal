import { Fragment, ReactElement, ReactNode } from 'react'
import Link from 'next/link'
import { formatDuration, intervalToDuration } from 'date-fns'
import { useAsset } from '@context/Asset'
import ExplorerLink from '@shared/ExplorerLink'
import Markdown from '@shared/Markdown'
import Publisher from '@shared/Publisher'
import { ethers } from 'ethers'
import { accountTruncate } from '@utils/wallet'
import useDateFnsLocale from '../../i18n/useDateFnsLocale'
import useFindingAid from './useFindingAid'
import useProvenanceEvents from './useProvenanceEvents'
import styles from './index.module.css'

type Source = 'chain' | 'publisher' | 'absent'

interface Row {
  label: string
  sub?: string
  source: Source
  body: ReactNode
}

// Values from the chain and from the publisher are data, shown as they are.
// Only the words around them come from content/findingAid(.ja).json.
function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    text
  )
}

// One unambiguous form for every date on the page. Archivists compare these
// dates with each other, so they must not be relative ("3 months ago") or
// shifted into the reader's time zone.
function utc(date: string | number): string {
  if (date === undefined || date === null || date === '') return ''
  const d =
    typeof date === 'number'
      ? new Date(date * 1000)
      : // The index server writes chain times without a zone; they are UTC.
        new Date(/Z|[+-]\d\d:?\d\d$/.test(date) ? date : `${date}Z`)
  if (isNaN(d.getTime())) return String(date)
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function SourceBadge({
  source,
  label
}: {
  source: Source
  label: string
}): ReactElement {
  return (
    <span className={`${styles.badge} ${styles[`badge-${source}`]}`}>
      {label}
    </span>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export default function FindingAid(): ReactElement {
  const { asset } = useAsset()
  const fa = useFindingAid()
  const { values: v } = fa
  const dateLocale = useDateFnsLocale()
  const { loading, events, uses } = useProvenanceEvents(asset)

  const { chainId } = asset
  const { metadata } = asset
  // The event index stores addresses in lower case; the record itself uses
  // the checksummed form. Show one form so the same account looks the same.
  const short = (account: string) => {
    try {
      return accountTruncate(ethers.utils.getAddress(account))
    } catch {
      return accountTruncate(account)
    }
  }

  const tx = (hash: string, text: ReactNode) => (
    <ExplorerLink networkId={chainId} path={`tx/${hash}`}>
      {text}
    </ExplorerLink>
  )

  const lastChange = [...events]
    .reverse()
    .find((e) => e.kind === 'update' && e.type === 'METADATA_UPDATED')
  const declaredUpdated = metadata?.updated
    ? new Date(metadata.updated).getTime() / 1000
    : undefined
  // A few seconds between signing and mining is normal; a day is not.
  const dateMismatch =
    lastChange &&
    declaredUpdated &&
    lastChange.timestamp - declaredUpdated > 60 * 60

  function describeEvent(e: (typeof events)[number]): string {
    if (e.kind === 'minted')
      return fill(fa.events.minted, { account: short(e.to) })
    if (e.kind === 'transfer')
      return fill(fa.events.transfer, { from: short(e.from), to: short(e.to) })
    return fa.events[e.type as keyof typeof fa.events] || e.type
  }

  function timeout(seconds: number): string {
    if (!seconds) return v.timeoutNone
    const duration = formatDuration(
      intervalToDuration({ start: 0, end: seconds * 1000 }),
      { locale: dateLocale }
    )
    return fill(v.timeoutSeconds, { duration })
  }

  const typeWord =
    metadata?.type === 'algorithm' ? v.typeAlgorithm : v.typeDataset
  const price = asset.accessDetails
  const isFree =
    !price || price.type === 'free' || Number(price.price || 0) === 0
  const language = (metadata?.additionalInformation as { language?: string })
    ?.language
  const container = metadata?.algorithm?.container

  const areas: { title: string; rows: Row[] }[] = [
    {
      title: fa.areas.identity,
      rows: [
        {
          label: fa.fields.referenceCode,
          source: 'chain',
          body: (
            <dl className={styles.pairs}>
              <dt>{v.did}</dt>
              <dd>
                <code>{asset.id}</code>
              </dd>
              <dt>{v.registerAddress}</dt>
              <dd>
                <ExplorerLink
                  networkId={chainId}
                  path={`address/${asset.nft?.address}`}
                >
                  <code>{asset.nft?.address}</code>
                </ExplorerLink>
              </dd>
            </dl>
          )
        },
        {
          label: fa.fields.title,
          source: 'publisher',
          body: <strong>{metadata?.name}</strong>
        },
        {
          label: fa.fields.dates,
          source: 'publisher',
          body: (
            <dl className={styles.pairs}>
              <dt>{v.declaredCreated}</dt>
              <dd>{utc(metadata?.created)}</dd>
              <dt>{v.declaredUpdated}</dt>
              <dd>{utc(metadata?.updated)}</dd>
            </dl>
          )
        },
        {
          label: fa.fields.dates,
          source: 'chain',
          body: (
            <dl className={styles.pairs}>
              <dt>{v.registeredOn}</dt>
              <dd>
                {asset.event?.tx
                  ? tx(asset.event.tx, utc(asset.event.datetime))
                  : utc(asset.nft?.created)}
              </dd>
              {lastChange && (
                <>
                  <dt>{v.lastChangedOn}</dt>
                  <dd>{tx(lastChange.tx, utc(lastChange.timestamp))}</dd>
                </>
              )}
            </dl>
          )
        },
        {
          label: fa.fields.level,
          source: 'publisher',
          body: fill(v.levelItem, { type: typeWord })
        },
        {
          label: fa.fields.extent,
          source: 'absent',
          body: v.extentHidden
        }
      ]
    },
    {
      title: fa.areas.context,
      rows: [
        metadata?.author
          ? {
              label: fa.fields.creator,
              source: 'publisher',
              body: metadata.author
            }
          : { label: fa.fields.creator, source: 'absent', body: null },
        {
          label: fa.fields.custodialHistory,
          source: 'chain',
          body: (
            <>
              <dl className={styles.pairs}>
                <dt>{v.currentCustodian}</dt>
                <dd>
                  <Publisher account={asset.nft?.owner} />
                </dd>
              </dl>
              {loading ? (
                <p className={styles.muted}>{v.loadingEvents}</p>
              ) : events.length === 0 ? (
                <p className={styles.muted}>{v.noEvents}</p>
              ) : (
                <ol className={styles.timeline}>
                  {events.map((e) => (
                    <li key={e.id}>
                      <span className={styles.when}>{utc(e.timestamp)}</span>
                      {tx(e.tx, describeEvent(e))}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )
        },
        {
          label: fa.fields.acquisition,
          source: 'chain',
          body: asset.event?.from ? (
            <>
              {fill(v.acquisitionFrom, { account: short(asset.event.from) })}{' '}
              {tx(asset.event.tx, <code>{short(asset.event.tx)}</code>)}
            </>
          ) : null
        }
      ]
    },
    {
      title: fa.areas.content,
      rows: [
        metadata?.description
          ? {
              label: fa.fields.scope,
              source: 'publisher',
              body: (
                <Markdown
                  className={styles.description}
                  text={metadata.description}
                  blockImages
                />
              )
            }
          : { label: fa.fields.scope, source: 'absent', body: null },
        {
          label: fa.fields.appraisal,
          source: 'chain',
          body: (
            <>
              <p>
                {v.state[String(asset.nft?.state ?? 0) as keyof typeof v.state]}
              </p>
              <p className={styles.muted}>{v.stateNote}</p>
            </>
          )
        }
      ]
    },
    {
      title: fa.areas.access,
      rows: [
        {
          label: fa.fields.access,
          source: 'publisher',
          body: (
            <>
              {asset.services.map((service) => {
                const c = service.compute
                const trusted = c?.publisherTrustedAlgorithms
                return (
                  <div key={service.id} className={styles.service}>
                    <p>
                      <strong>
                        {service.type === 'compute'
                          ? v.serviceCompute
                          : v.serviceAccess}
                      </strong>
                    </p>
                    <ul>
                      <li>
                        {v.heldBy}:{' '}
                        <code>{hostOf(service.serviceEndpoint)}</code>
                      </li>
                      <li>{timeout(service.timeout)}</li>
                      {c && (
                        <>
                          <li>
                            {c.allowRawAlgorithm
                              ? v.rawAlgorithmYes
                              : v.rawAlgorithmNo}
                          </li>
                          <li>
                            {c.allowNetworkAccess ? v.networkYes : v.networkNo}
                          </li>
                          <li>
                            {trusted === null || trusted === undefined
                              ? v.trustedAny
                              : trusted.length === 0
                              ? v.trustedNone
                              : fill(v.trustedCount, {
                                  count: trusted.length
                                })}
                          </li>
                        </>
                      )}
                      <li>
                        {asset.credentials?.allow?.length
                          ? fill(v.allowList, {
                              count: asset.credentials.allow.length
                            })
                          : v.allowAll}
                      </li>
                      {asset.credentials?.deny?.length > 0 && (
                        <li>
                          {fill(v.denyList, {
                            count: asset.credentials.deny.length
                          })}
                        </li>
                      )}
                    </ul>
                  </div>
                )
              })}
              <p className={styles.muted}>{v.enforced}</p>
            </>
          )
        },
        {
          label: fa.fields.access,
          source: 'chain',
          body: isFree
            ? v.priceFree
            : fill(v.pricePaid, {
                price: price.price,
                symbol: price.baseToken?.symbol || ''
              })
        },
        {
          label: fa.fields.use,
          source: 'chain',
          body: loading ? (
            <p className={styles.muted}>{v.loadingEvents}</p>
          ) : uses.length === 0 ? (
            v.useNone
          ) : (
            <>
              <p>{fill(v.useCount, { count: uses.length })}</p>
              <ol className={styles.timeline}>
                {uses.slice(0, 5).map((u) => (
                  <li key={u.id}>
                    <span className={styles.when}>{utc(u.timestamp)}</span>
                    {tx(u.tx, fill(v.useBy, { account: short(u.consumer) }))}
                  </li>
                ))}
              </ol>
            </>
          )
        },
        metadata?.license
          ? {
              label: fa.fields.reproduction,
              source: 'publisher',
              body: <code>{metadata.license}</code>
            }
          : { label: fa.fields.reproduction, source: 'absent', body: null },
        language
          ? { label: fa.fields.language, source: 'publisher', body: language }
          : {
              label: fa.fields.language,
              source: 'absent',
              body: v.noLanguageField
            },
        container
          ? {
              label: fa.fields.technical,
              source: 'publisher',
              body: (
                <>
                  {v.container}:{' '}
                  <code>{`${container.image}:${container.tag}`}</code>
                </>
              )
            }
          : {
              label: fa.fields.technical,
              source: 'absent',
              body: v.noTechnicalField
            }
      ]
    },
    {
      title: fa.areas.allied,
      rows: [
        metadata?.links?.length
          ? {
              label: fa.fields.related,
              source: 'publisher',
              body: (
                <ul>
                  {metadata.links.map((link) => (
                    <li key={link}>
                      <a href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              )
            }
          : { label: fa.fields.related, source: 'absent', body: null }
      ]
    },
    {
      title: fa.areas.notes,
      rows: [
        metadata?.tags?.length
          ? {
              label: fa.fields.notes,
              source: 'publisher',
              body: (
                <ul className={styles.tags}>
                  {metadata.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              )
            }
          : { label: fa.fields.notes, source: 'absent', body: null }
      ]
    },
    {
      title: fa.areas.control,
      rows: [
        {
          label: fa.fields.rules,
          source: 'publisher',
          body: (
            <>
              <p>{fill(v.rules, { version: asset.version })}</p>
              <p className={styles.muted}>{v.rulesNote}</p>
            </>
          )
        },
        {
          label: fa.fields.descriptionDates,
          source: 'publisher',
          body: utc(metadata?.updated || metadata?.created)
        },
        {
          label: fa.fields.descriptionDates,
          source: 'chain',
          body: lastChange
            ? tx(lastChange.tx, utc(lastChange.timestamp))
            : asset.event?.tx
            ? tx(asset.event.tx, utc(asset.event.datetime))
            : null
        }
      ]
    }
  ]

  const rows = areas.flatMap((area) => area.rows)
  const count = (source: Source) =>
    rows.filter((row) => row.source === source).length

  return (
    <div className={styles.findingAid}>
      <div className={styles.toolbar}>
        <Link href={`/asset/${asset.id}`}>← {fa.backToRecord}</Link>
        <button
          type="button"
          className={styles.print}
          onClick={() => window.print()}
        >
          {fa.print}
        </button>
      </div>

      <p className={styles.kicker}>{fa.kicker}</p>
      <div className={styles.intro}>
        {fa.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <aside className={styles.legend}>
        <h2>{fa.sourcesTitle}</h2>
        <ul>
          {(['chain', 'publisher', 'absent'] as const).map((source) => (
            <li key={source}>
              <SourceBadge source={source} label={fa.sources[source].label} />
              <span>{fa.sources[source].explain}</span>
            </li>
          ))}
        </ul>
        <p className={styles.tally}>
          {fill(fa.tally, {
            total: rows.length,
            chain: count('chain'),
            publisher: count('publisher'),
            absent: count('absent')
          })}
        </p>
      </aside>

      {dateMismatch && (
        <p className={styles.mismatch} role="note">
          {fill(v.dateMismatch, {
            declared: utc(metadata.updated),
            recorded: utc(lastChange.timestamp)
          })}
        </p>
      )}

      {areas.map((area) => (
        <section key={area.title} className={styles.area}>
          <h2>{area.title}</h2>
          <dl className={styles.rows}>
            {area.rows.map((row, i) => (
              <Fragment key={`${row.label}-${row.source}-${i}`}>
                <dt className={styles[row.source]}>{row.label}</dt>
                <dd className={styles[row.source]}>
                  <SourceBadge
                    source={row.source}
                    label={fa.sources[row.source].label}
                  />
                  <div className={styles.value}>
                    {row.body ?? <span className={styles.muted}>—</span>}
                  </div>
                </dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ))}

      <p className={styles.archivistNote}>
        <strong>{fa.fields.archivistNote}.</strong>{' '}
        {fill(v.archivistNote, { today: utc(Date.now() / 1000).slice(0, 10) })}
      </p>
    </div>
  )
}
