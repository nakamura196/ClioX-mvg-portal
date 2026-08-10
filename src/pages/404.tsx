import { ReactElement } from 'react'
import Page from '@shared/Page'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'

export default function Page404(): ReactElement {
  const router = useRouter()
  const { t } = useTranslation('common')

  return (
    <>
      <Head>
        <style type="text/css">{`
          main {
            text-align: center;
          }
        `}</style>
      </Head>
      <Page
        title={t('error.notFoundTitle')}
        description={t('error.notFoundBody')}
        uri={router.route}
        headerCenter
        noPageHeader
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <h1 className="text-6xl font-bold text-[var(--brand-clay)] mb-4">
            404
          </h1>
          <h2 className="text-3xl font-semibold text-[var(--font-color-heading)] mb-6">
            {t('error.notFoundHeading')}
          </h2>
          <p className="text-lg text-[var(--font-color-text)] max-w-md mb-8">
            {t('error.notFoundBody')}
          </p>
          <Link
            href="/"
            className="bg-[var(--brand-clay)] text-white px-6 py-3 rounded-md hover:bg-[var(--color-highlight)] transition-all duration-200 ease-in-out hover:scale-[1.01] font-bold"
          >
            {t('error.backHome')}
          </Link>
        </div>
      </Page>
    </>
  )
}
