import classNames from 'classnames/bind'
import { ReactElement } from 'react'
import VerifiedPatch from '@images/patch_check.svg'
import Cross from '@images/cross.svg'
import styles from './index.module.css'
import Loader from '../atoms/Loader'
import Time from '../atoms/Time'
import Tooltip from '../atoms/Tooltip'
import { useTranslation } from 'react-i18next'

const cx = classNames.bind(styles)

export function Badge({
  isValid,
  isIdMatchVerifiable,
  verifiedService,
  className
}: {
  isValid: boolean
  isIdMatchVerifiable?: string
  verifiedService: string
  className?: string
}): ReactElement {
  return (
    <div
      className={cx({
        mainLabel: true,
        isValid,
        isWarning: isIdMatchVerifiable?.length > 0,
        [className]: className
      })}
    >
      {isIdMatchVerifiable?.length > 0 ? (
        <Tooltip content={isIdMatchVerifiable}>
          <div className={`${styles.mainLabel} ${styles.isWarning}`}>
            <span>{verifiedService}</span>
            <Cross />
          </div>
        </Tooltip>
      ) : (
        <>
          <span>{verifiedService}</span>
          {isValid ? <VerifiedPatch /> : <Cross />}
        </>
      )}
    </div>
  )
}

export default function VerifiedBadge({
  className,
  isValid,
  idMatch,
  isIdMatchVerifiable,
  isLoading,
  apiVersion,
  timestamp
}: {
  className?: string
  isValid?: boolean
  idMatch?: boolean
  isIdMatchVerifiable?: string
  isLoading?: boolean
  apiVersion?: string
  timestamp?: boolean
}): ReactElement {
  const { t } = useTranslation('common')
  const styleClasses = cx({
    verifiedBadge: true,
    [className]: className
  })

  const formattedApiVersion =
    apiVersion && apiVersion.slice(0, 2) + '.' + apiVersion.slice(2, 4)

  return (
    <div className={styles.container}>
      {isLoading ? (
        <Loader message={t('verify.verifying')} />
      ) : (
        <div className={styleClasses}>
          <Badge
            isValid={isValid}
            verifiedService={t('verify.serviceCredential')}
          />
          <Badge
            isValid={idMatch}
            isIdMatchVerifiable={isIdMatchVerifiable}
            verifiedService={t('verify.credentialIdMatch')}
          />
          <div className={styles.details}>
            {apiVersion && (
              <span className={styles.apiVersion}>
                {t('verify.version')} {formattedApiVersion}
              </span>
            )}
            {timestamp && (
              <span className={styles.lastVerified}>
                {t('verify.lastCheck')}{' '}
                <Time date={new Date().toString()} relative />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
