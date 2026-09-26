import { ReactElement } from 'react'
import { prettySize } from './utils'
import cleanupContentType from '@utils/cleanupContentType'
import styles from './Info.module.css'
import { FileInfo as FileInfoData } from '@oceanprotocol/lib'
import { useTranslation } from 'react-i18next'

export default function FileInfo({
  file,
  handleClose
}: {
  file: FileInfoData
  handleClose(): void
}): ReactElement {
  const { t } = useTranslation('common')
  const contentTypeCleaned = file.contentType
    ? cleanupContentType(file.contentType)
    : null

  const hideUrl = file.type === 'hidden' || false

  return (
    <div className={`${styles.info}`}>
      <h3 className={`${styles.url} ${hideUrl ? styles.hideUrl : null}`}>
        {hideUrl ? 'https://delta-dao/the-future-is-now' : file.url}
      </h3>
      <ul>
        <li className={styles.success}>{t('publish.fileConfirmed')}</li>
        {file.contentLength && <li>{prettySize(+file.contentLength)}</li>}
        {contentTypeCleaned && <li>{contentTypeCleaned}</li>}
      </ul>
      <button className={styles.removeButton} onClick={handleClose}>
        &times;
      </button>
    </div>
  )
}
