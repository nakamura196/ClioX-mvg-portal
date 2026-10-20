import { ReactElement } from 'react'
import Alert from '@shared/atoms/Alert'
import Footer from '../Footer/Footer'
import Header from '../Header'
import { useAccountPurgatory } from '@hooks/useAccountPurgatory'
import AnnouncementBanner from '@shared/AnnouncementBanner'
import PrivacyPreferenceCenter from '../Privacy/PrivacyPreferenceCenter'
import styles from './index.module.css'
import { ToastContainer } from 'react-toastify'
import contentPurgatory from '../../../content/purgatory.json'
import { useMarketMetadata } from '@context/MarketMetadata'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/router'
import FirstRunTour from '../FirstRunTour'
import { FirstRunTourProvider } from '../FirstRunTour/context'
import ArchivistModeBanner from '../ArchivistMode/Banner'

export default function App({
  children
}: {
  children: ReactElement
}): ReactElement {
  const { siteContent, appConfig } = useMarketMetadata()
  const { address } = useAccount()
  const { isInPurgatory, purgatoryData } = useAccountPurgatory(address)
  const router = useRouter()

  // 実験の参加者画面では、ポータルの見出し・案内ツアー・フッターを出さない。
  // 参加者が条件と関係のない情報（料金、案内、他のページ）を見ないようにするため。
  // 研究者向けの ?view=design / ?view=receipt は通常の枠で出す。
  const isExperimentParticipant =
    router.pathname === '/experiment' && !router.query.view
  // 研究者向けの画面でも案内ツアーは出さない（ツアーの題材と関係がなく、ボタンも覆ってしまう）。
  const isExperiment = router.pathname === '/experiment'

  if (isExperimentParticipant) {
    return (
      <FirstRunTourProvider>
        <div className={styles.app}>
          <main className={styles.main}>{children}</main>
        </div>
      </FirstRunTourProvider>
    )
  }

  const devPreviewAnnouncementText =
    siteContent?.devPreviewAnnouncement
      ?.replaceAll('SITE-TITLE-PLACEHOLDER', siteContent.siteTitle)
      ?.replaceAll('SITE-LINK-PLACEHOLDER', siteContent.siteUrl) || ''

  return (
    <FirstRunTourProvider>
      <div className={styles.app}>
        {siteContent?.announcement !== '' && (
          <AnnouncementBanner
            state="warning"
            text={siteContent?.announcement}
          />
        )}
        {appConfig.showPreviewAlert === 'true' &&
          devPreviewAnnouncementText !== '' && (
            <AnnouncementBanner text={devPreviewAnnouncementText} />
          )}
        <Header />
        <ArchivistModeBanner />

        {isInPurgatory && (
          <Alert
            title={contentPurgatory.account.title}
            badge={`Reason: ${purgatoryData?.reason}`}
            text={contentPurgatory.account.description}
            state="error"
          />
        )}
        <main className={styles.main}>{children}</main>
        <Footer />

        {appConfig?.privacyPreferenceCenter === 'true' && (
          <PrivacyPreferenceCenter style="small" />
        )}

        <ToastContainer position="bottom-right" newestOnTop />
        {!isExperiment && <FirstRunTour />}
      </div>
    </FirstRunTourProvider>
  )
}
