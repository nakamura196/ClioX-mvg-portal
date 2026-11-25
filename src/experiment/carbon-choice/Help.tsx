import { ReactElement, useState } from 'react'
import styles from './index.module.css'

// A small "?" that opens a plain-language explanation under it.
export default function Help({
  label,
  text
}: {
  label: string
  text: string
}): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <span className={styles.help}>
      <button
        type="button"
        className={styles.helpButton}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open && (
        <span role="note" className={styles.helpText}>
          {text}
        </span>
      )}
    </span>
  )
}
