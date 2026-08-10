import { ReactElement } from 'react'
import Links from './Links'
import Container from '@components/@shared/atoms/Container'
import styles from './Footer.module.css'
import { useTranslation } from 'react-i18next'

export default function Footer(): ReactElement {
  const { t } = useTranslation('common')

  return (
    <footer className={styles.footer}>
      <Container className="mx-auto px-4 py-8">
        <Links />
        <div className="border-t border-gray-200 mt-8 pt-4 text-center md:text-left">
          <p className="text-xs opacity-80">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </Container>
    </footer>
  )
}
