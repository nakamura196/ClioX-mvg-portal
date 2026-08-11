import { useUserPreferences } from '@context/UserPreferences'
import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../atoms/Alert'
import styles from './index.module.css'

export default function ExternalContentWarning(): ReactElement {
  const { t } = useTranslation('common')
  const { setAllowExternalContent } = useUserPreferences()

  return (
    <Alert
      state="warning"
      title={t('asset.externalContentTitle')}
      text={t('asset.externalContentText')}
      action={{
        name: t('asset.externalContentAllow'),
        style: 'primary',
        handleAction: () => setAllowExternalContent(true)
      }}
      className={styles.externalContentAlert}
    />
  )
}
