import { ReactElement, ReactNode } from 'react'
import Link from 'next/link'
import Tooltip from '@shared/atoms/Tooltip'
import useArchivistGlossary, { ArchivistTermId } from './useArchivistGlossary'
import styles from './index.module.css'

/**
 * Marks a technical word on screen and explains it in archival terms.
 *
 * The word gets a dotted underline; hovering or focusing it shows the short
 * definition and the closest archival practice, with a link to the full entry
 * on /glossary. Text comes from content/archivistGlossary(.ja).json.
 *
 * Without children it renders a small "?" badge instead, for places where the
 * word itself sits inside a button or link and cannot be wrapped.
 */
export default function ArchivistTerm({
  id,
  children
}: {
  id: ArchivistTermId
  children?: ReactNode
}): ReactElement {
  const glossary = useArchivistGlossary()
  const entry = glossary.terms[id]
  if (!entry) return <>{children}</>

  const content = (
    <div className={styles.card}>
      <strong className={styles.term}>{entry.term}</strong>
      <p>{entry.short}</p>
      <p className={styles.archival}>
        <span className={styles.label}>{glossary.labels.archival}</span>
        {entry.archival}
      </p>
      <Link href={`/glossary#${id}`} className={styles.more}>
        {glossary.labels.more} →
      </Link>
    </div>
  )

  return (
    <Tooltip content={content} trigger="mouseenter focus click">
      {children ? (
        <span className={styles.trigger} tabIndex={0} role="button">
          {children}
        </span>
      ) : (
        <span
          className={styles.badge}
          tabIndex={0}
          role="button"
          aria-label={entry.term}
        >
          ?
        </span>
      )}
    </Tooltip>
  )
}
