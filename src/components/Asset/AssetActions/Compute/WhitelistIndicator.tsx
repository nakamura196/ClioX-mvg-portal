import { accountTruncate } from '@utils/wallet'
import { Badge } from '@components/@shared/VerifiedBadge'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames/bind'
import styles from './WhitelistIndicator.module.css'

const cx = classNames.bind(styles)

export default function WhitelistIndicator({
  accountId,
  isAccountIdWhitelisted,
  minimal
}: {
  accountId: string
  isAccountIdWhitelisted: boolean
  minimal?: boolean
}) {
  const { t } = useTranslation('common')
  const styleClasses = cx({
    container: true,
    minimal
  })

  return (
    <div className={styleClasses}>
      <Badge
        isValid={isAccountIdWhitelisted}
        verifiedService={
          isAccountIdWhitelisted
            ? t('asset.accessAllowed')
            : t('asset.accessDenied')
        }
        className={styles.whitelistBadge}
      />
      {!isAccountIdWhitelisted && (
        <p className={styles.invalidAddressMessage}>
          {t('asset.notWhitelisted', { account: accountTruncate(accountId) })}
        </p>
      )}
    </div>
  )
}
