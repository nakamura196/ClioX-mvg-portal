import { useAsset } from '@context/Asset'
import { useTranslation } from 'react-i18next'
import styles from './index.module.css'

export default function AssetStats() {
  const { t } = useTranslation('common')
  const { asset } = useAsset()

  return (
    <footer className={styles.stats}>
      {!asset?.stats || asset?.stats?.orders < 0 ? (
        <span className={styles.stat}>{t('asset.salesUnavailable')}</span>
      ) : asset?.stats?.orders === 0 ? (
        <span className={styles.stat}>{t('asset.noSalesYet')}</span>
      ) : (
        <span className={styles.stat}>
          <span className={styles.number}>{asset.stats.orders}</span>{' '}
          {t('asset.sales', { count: asset.stats.orders })}
        </span>
      )}
    </footer>
  )
}
