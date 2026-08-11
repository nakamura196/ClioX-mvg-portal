import { markdownToHtml } from '@utils/markdown'
import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './Empty.module.css'

export default function Empty({ message }: { message?: string }): ReactElement {
  const { t } = useTranslation('common')

  return (
    <div
      className={styles.empty}
      dangerouslySetInnerHTML={{
        __html: markdownToHtml(message) || t('search.noResultsFound')
      }}
    />
  )
}
