import { ReactElement } from 'react'
import NumberUnit from './NumberUnit'
import styles from './Stats.module.css'
import { useProfile } from '@context/Profile'
import { useTranslation } from 'react-i18next'

export default function Stats(): ReactElement {
  const { assetsTotal, sales } = useProfile()
  const { t } = useTranslation('common')

  return (
    <div className={styles.stats}>
      <NumberUnit
        label={t('profile.sales', { count: sales })}
        value={typeof sales !== 'number' || sales < 0 ? 0 : sales}
      />
      <NumberUnit label={t('profile.published')} value={assetsTotal} />
    </div>
  )
}
