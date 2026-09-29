import { ReactElement } from 'react'
import { useArchivistMode, useArchivistModeUi } from '@context/ArchivistMode'
import styles from './index.module.css'

/** Header switch between the full view and the archivist view. */
export default function ArchivistModeToggle(): ReactElement {
  const { archivistMode, setArchivistMode } = useArchivistMode()
  const ui = useArchivistModeUi()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={archivistMode}
      title={ui.toggleHint}
      aria-label={ui.toggle}
      className={styles.toggle}
      onClick={() => setArchivistMode(!archivistMode)}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={styles.label}>{ui.toggle}</span>
    </button>
  )
}
