import { ReactElement, useEffect } from 'react'
import Link from 'next/link'
import useArchivistGlossary, {
  ArchivistTermId
} from '@shared/ArchivistTerm/useArchivistGlossary'
import styles from './index.module.css'

export default function ArchivistGlossary(): ReactElement {
  const glossary = useArchivistGlossary()
  const { labels } = glossary

  // Tooltips link to /glossary#<term>. The browser's own jump can fire before
  // hydration settles the layout, so scroll again once we are mounted.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  return (
    <div className={styles.glossary}>
      <div className={styles.intro}>
        {glossary.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <aside className={styles.reassurance}>
        <h2>{glossary.reassurance.title}</h2>
        <ul>
          {glossary.reassurance.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </aside>

      <nav className={styles.jump} aria-label={labels.jumpTo}>
        {glossary.groups.map((group) =>
          group.terms.map((id) => (
            <a key={id} href={`#${id}`}>
              {glossary.terms[id as ArchivistTermId].term}
            </a>
          ))
        )}
      </nav>

      {glossary.groups.map((group) => (
        <section key={group.title} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          {group.terms.map((id) => {
            const entry = glossary.terms[id as ArchivistTermId]
            return (
              <article key={id} id={id} className={styles.entry}>
                <header className={styles.entryHeader}>
                  <h3>{entry.term}</h3>
                  {entry.onScreen.length > 0 && (
                    <div className={styles.onScreen}>
                      <span className={styles.label}>{labels.onScreen}</span>
                      {entry.onScreen.map((label) => (
                        <code key={label}>{label}</code>
                      ))}
                    </div>
                  )}
                </header>
                <p className={styles.short}>{entry.short}</p>
                <dl className={styles.fields}>
                  <dt>{labels.plain}</dt>
                  <dd>{entry.plain}</dd>
                  <dt className={styles.archivalTitle}>{labels.archival}</dt>
                  <dd className={styles.archival}>{entry.archival}</dd>
                  <dt>{labels.limits}</dt>
                  <dd>{entry.limits}</dd>
                  <dt>{labels.safety}</dt>
                  <dd>{entry.safety}</dd>
                </dl>
                {entry.interpares && (
                  <Link
                    className={styles.interpares}
                    href={`/resources?tab=glossary&term=${entry.interpares}`}
                  >
                    {labels.interpares}: {entry.interpares} →
                  </Link>
                )}
              </article>
            )
          })}
        </section>
      ))}
    </div>
  )
}
