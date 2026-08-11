import { useUserPreferences } from '@context/UserPreferences'
import Refresh from '@images/refresh.svg'
import AssetListTitle from '@shared/AssetListTitle'
import NetworkName from '@shared/NetworkName'
import Button from '@shared/atoms/Button'
import Table, { TableOceanColumn } from '@shared/atoms/Table'
import Time from '@shared/atoms/Time'
import { ReactElement, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import Details from './Details'
import styles from './index.module.css'
import { useTranslation } from 'react-i18next'

export function Status({ children }: { children: string }): ReactElement {
  const { t } = useTranslation('common')

  // statusText は Ocean Node がそのまま返す英語文字列。既知のものだけ訳し、
  // 未知の値は原文のまま出す（欠落した状態を隠さないため）。
  return (
    <div className={styles.status}>
      {t(`compute.status.${children}`, { defaultValue: children })}
    </div>
  )
}

const getColumns = (
  t: (key: string) => string
): TableOceanColumn<ComputeJobMetaData>[] => [
  {
    name: t('compute.columns.dataset'),
    selector: (row) => (
      <AssetListTitle did={row.inputDID?.[0] ?? ''} title={row.assetName} />
    ),
    wrap: true,
    allowOverflow: true,
    grow: 2,
    minWidth: '260px'
  },
  {
    name: t('compute.columns.network'),
    selector: (row) => <NetworkName networkId={row.networkId} />
  },
  {
    name: t('compute.columns.provider'),
    selector: (row) => <span title={row.providerUrl}>{row.providerUrl}</span>
  },
  {
    name: t('compute.columns.created'),
    selector: (row) => <Time date={row.dateCreated} isUnix relative />
  },
  {
    name: t('compute.columns.finished'),
    selector: (row) =>
      row.dateFinished ? <Time date={row.dateFinished} isUnix relative /> : ''
  },
  {
    name: t('compute.columns.status'),
    selector: (row) => <Status>{row.statusText}</Status>
  }
]

const getDefaultActionsColumn = (
  t: (key: string) => string
): TableOceanColumn<ComputeJobMetaData> => ({
  name: t('compute.columns.actions'),
  selector: (row) => <Details job={row} />
})

export type GetCustomActions = (job: ComputeJobMetaData) => {
  label: ReactElement
  onClick: (job: ComputeJobMetaData) => void
}[]

export default function ComputeJobs({
  minimal,
  jobs,
  isLoading,
  refetchJobs,
  getActions,
  hideDetails
}: {
  minimal?: boolean
  jobs?: ComputeJobMetaData[]
  isLoading?: boolean
  refetchJobs?: any
  getActions?: (job: ComputeJobMetaData) => {
    label: ReactElement
    onClick: (job: ComputeJobMetaData) => void
  }[]
  hideDetails?: boolean
}): ReactElement {
  const { t } = useTranslation('common')
  const { address: accountId } = useAccount()
  const { chainIds } = useUserPreferences()

  const columns = getColumns(t)
  const defaultActionsColumn = getDefaultActionsColumn(t)

  const [actionsColumn, setActionsColumn] =
    useState<TableOceanColumn<ComputeJobMetaData>>(defaultActionsColumn)

  useEffect(() => {
    if (!getActions) return
    setActionsColumn({
      name: defaultActionsColumn.name,
      selector: (row) => (
        <div className="inline-flex items-center gap-2">
          {getActions(row).map((action, i) => (
            <Button
              key={`compute-job-action-${action.label}-${i}`}
              size="small"
              style="text"
              onClick={() => action.onClick(row)}
              className="min-w-24 text-center whitespace-nowrap"
            >
              {action.label}
            </Button>
          ))}
          {!hideDetails && <Details job={row} />}
        </div>
      )
    })
  }, [getActions])

  return accountId ? (
    <>
      {jobs?.length >= 0 && !minimal && (
        <Button
          style="text"
          size="small"
          title={t('compute.refreshTitle')}
          onClick={async () => await refetchJobs(true)}
          disabled={isLoading}
          className={styles.refresh}
        >
          <Refresh />
          {t('compute.refresh')}
        </Button>
      )}
      <Table
        columns={
          minimal
            ? // for minimal view, we only want 'Status', actions and 'Finished'
              [columns[5], actionsColumn, columns[4]]
            : [...columns, actionsColumn]
        }
        data={jobs}
        isLoading={isLoading}
        defaultSortFieldId="row.dateCreated"
        defaultSortAsc={false}
        emptyMessage={chainIds.length === 0 ? t('bookmarks.noNetwork') : null}
        onChangePage={async () => await refetchJobs(true)}
      />
    </>
  ) : (
    <div>{t('profile.connectWallet')}</div>
  )
}
