import { ReactElement } from 'react'
import MetaItem from './MetaItem'
import styles from './MetaSecondary.module.css'
import Tags from '@shared/atoms/Tags'
import Button from '@shared/atoms/Button'
import { Asset } from '@oceanprotocol/lib'
import { useTranslation } from 'react-i18next'

const SampleButton = ({ url }: { url: string }) => {
  const { t } = useTranslation('common')

  return (
    <Button
      href={url}
      target="_blank"
      rel="noreferrer"
      download
      style="text"
      size="small"
    >
      {t('asset.downloadSample')}
    </Button>
  )
}

export default function MetaSecondary({ ddo }: { ddo: Asset }): ReactElement {
  const { t } = useTranslation('common')

  return (
    <aside className={styles.metaSecondary}>
      {ddo?.metadata.links?.length > 0 && (
        <div className={styles.samples}>
          <MetaItem
            title={t('asset.sampleData')}
            content={<SampleButton url={ddo?.metadata.links[0]} />}
          />
        </div>
      )}
      {ddo?.metadata?.tags?.length > 0 && <Tags items={ddo?.metadata?.tags} />}
    </aside>
  )
}
