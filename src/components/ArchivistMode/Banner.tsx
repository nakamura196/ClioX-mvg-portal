import { ReactElement } from 'react'
import { useArchivistMode, useArchivistModeUi } from '@context/ArchivistMode'
import styles from './index.module.css'

/**
 * Says, while the archivist view is on, that details are hidden rather than
 * gone, and offers the way back. Hiding things silently would cost trust.
 */
export default function ArchivistModeBanner(): ReactElement {
  const { archivistMode, setArchivistMode } = useArchivistMode()
  const ui = useArchivistModeUi()
  if (!archivistMode) return null

  return (
    <div className={styles.banner} role="status">
      <p>
        <strong>{ui.bannerTitle}</strong> {ui.bannerText}
      </p>
      <button
        type="button"
        className={styles.bannerOff}
        onClick={() => setArchivistMode(false)}
      >
        {ui.bannerOff}
      </button>
    </div>
  )
}
