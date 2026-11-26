import { ReactElement } from 'react'
import NumberUnit from './NumberUnit'
import styles from './Stats.module.css'
import { useProfile } from '@context/Profile'
import { useTranslation } from 'react-i18next'

export default function Stats(): ReactElement {
  const { assetsTotal, sales } = useProfile()
  const { t } = useTranslation('common')
  // sales は読み込み中 undefined。count が数でないと i18next が複数形の
  // キー(sales_other)を探さず、画面に "profile.sales" がそのまま出る。
  const salesCount = typeof sales !== 'number' || sales < 0 ? 0 : sales

  return (
    <div className={styles.stats}>
      <NumberUnit
        label={t('profile.sales', { count: salesCount })}
        value={salesCount}
      />
      <NumberUnit label={t('profile.published')} value={assetsTotal} />
    </div>
  )
}
