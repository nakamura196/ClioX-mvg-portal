import { ReactElement } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import styles from './index.module.css'

// [prototype] Breadcrumbs on the prototype pages (2026-11-25):
// Home › Prototypes › <page>. Rendered by the shared Page for every route;
// it shows nothing outside /experiment.

const LABELS = {
  home: ['Home', 'ホーム'],
  prototypes: ['Prototypes', '試作'],
  nav: ['Breadcrumb', 'パンくずリスト']
}

export default function ExperimentBreadcrumb({
  title
}: {
  title?: string
}): ReactElement | null {
  const router = useRouter()
  const { i18n } = useTranslation()
  if (!router?.route?.startsWith('/experiment')) return null
  const i = (i18n?.language || 'en').startsWith('ja') ? 1 : 0
  const isIndex = router.route === '/experiment'

  return (
    <nav aria-label={LABELS.nav[i]} className={styles.breadcrumb}>
      <ol>
        <li>
          <Link href="/">{LABELS.home[i]}</Link>
        </li>
        <li>
          {isIndex ? (
            <span aria-current="page">{LABELS.prototypes[i]}</span>
          ) : (
            <Link href="/experiment">{LABELS.prototypes[i]}</Link>
          )}
        </li>
        {!isIndex && title && (
          <li>
            <span aria-current="page">{title}</span>
          </li>
        )}
      </ol>
    </nav>
  )
}
