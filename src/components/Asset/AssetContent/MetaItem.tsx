import { ReactElement, ReactNode } from 'react'
import styles from './MetaItem.module.css'

export default function MetaItem({
  title,
  content,
  jargon
}: {
  title: ReactNode
  content: ReactNode
  /** Hidden in the archivist view (on-chain detail, not description) */
  jargon?: boolean
}): ReactElement {
  return (
    <div className={styles.metaItem} data-jargon={jargon || undefined}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.content}>{content}</div>
    </div>
  )
}
