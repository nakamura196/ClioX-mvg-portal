import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { filesize } from 'filesize'
import cleanupContentType from '@utils/cleanupContentType'
import styles from './index.module.css'
import Loader from '@shared/atoms/Loader'
import { FileInfo } from '@oceanprotocol/lib'

function LoaderArea() {
  return (
    <div className={styles.loaderWrap}>
      <Loader />
    </div>
  )
}

export default function FileIcon({
  file,
  isAccountWhitelisted,
  className,
  small,
  isLoading
}: {
  file: FileInfo
  isAccountWhitelisted: boolean
  className?: string
  small?: boolean
  isLoading?: boolean
}): ReactElement {
  const { t } = useTranslation('common')
  const styleClasses = `${styles.file} ${small ? styles.small : ''} ${
    className || ''
  }`

  return (
    <ul className={styleClasses}>
      {!isLoading ? (
        <>
          {/* ウォレット未接続（undefined）でも出す。ノードは誰にでもファイル情報を
              返しており、隠す意味が無い。隠すのは拒否されたアカウント（false）だけ */}
          {isAccountWhitelisted !== false &&
          (file?.contentType || file?.contentLength) ? (
            <>
              <li>{cleanupContentType(file.contentType)}</li>
              <li>
                {file.contentLength && file.contentLength !== '0'
                  ? filesize(Number(file.contentLength)).toString()
                  : ''}
              </li>
              <li>
                {file.type === 'smartcontract' ? 'smart\ncontract' : file.type}
              </li>
            </>
          ) : (
            <li className={styles.empty}>{t('asset.noFileInfo')}</li>
          )}
        </>
      ) : (
        <LoaderArea />
      )}
    </ul>
  )
}
