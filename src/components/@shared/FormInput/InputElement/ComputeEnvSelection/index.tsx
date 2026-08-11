import Dotdotdot from 'react-dotdotdot'
import slugify from 'slugify'
import PriceUnit from '@shared/Price/PriceUnit'
import Loader from '@shared/atoms/Loader'
import styles from './index.module.css'
import assetSelectionStyles from '../AssetSelection/index.module.css'
import { Empty } from '../AssetSelection'
import { formatDuration, intervalToDuration } from 'date-fns'
import { useMarketMetadata } from '@context/MarketMetadata'
import Tooltip from '@components/@shared/atoms/Tooltip'
import { useTranslation } from 'react-i18next'
import useDateFnsLocale from '../../../../../i18n/useDateFnsLocale'
import ComputeEnvDetails from './ComputeEnvDetails'

export default function ComputeEnvSelection({
  computeEnvs,
  selected,
  disabled,
  ...props
}: {
  computeEnvs: ComputeEnvironmentExtended[]
  selected?: string
  disabled?: boolean
}): JSX.Element {
  const { t } = useTranslation('common')
  const dateFnsLocale = useDateFnsLocale()
  const {
    approvedBaseTokens,
    appConfig: { defaultTokenSymbol }
  } = useMarketMetadata()
  const styleClassesWrapper = `${styles.selection} ${
    disabled ? assetSelectionStyles.disabled : ''
  }`

  return (
    <div className={styleClassesWrapper}>
      <div className={styles.scroll}>
        {!computeEnvs ? (
          <Loader />
        ) : computeEnvs && !computeEnvs.length ? (
          <Empty message={t('compute.noEnvironment')} />
        ) : (
          computeEnvs.map((env) => (
            <div className={styles.row} key={env.id}>
              <input
                id={slugify(env.id)}
                className={`${assetSelectionStyles.input} ${assetSelectionStyles.radio}`}
                {...props}
                checked={selected && env.id === selected}
                type="radio"
                value={env.id}
              />
              <label
                className={assetSelectionStyles.label}
                htmlFor={slugify(env.desc || env.id)}
                title={env.desc || env.id}
              >
                <h3 className={assetSelectionStyles.title}>
                  <Dotdotdot clamp={1} tagName="span">
                    {env.desc || env.id}
                  </Dotdotdot>
                  <Tooltip content={<ComputeEnvDetails computeEnv={env} />} />
                </h3>
                <Dotdotdot clamp={1} tagName="code" className={styles.details}>
                  {env?.cpuNumber > 0 && 'CPU | '}
                  {env?.gpuNumber > 0 && 'GPU | '}
                  {t('compute.maxDuration')}
                  {formatDuration(
                    intervalToDuration({
                      start: 0,
                      end: env?.maxJobDuration * 1000
                    }),
                    { locale: dateFnsLocale }
                  )}
                </Dotdotdot>
                <PriceUnit
                  price={env.priceMin}
                  size="small"
                  className={assetSelectionStyles.price}
                  symbol={`${
                    // [local patch] 無償のみの実行環境（fees 未設定）では feeToken が
                    // 存在せず、toLowerCase() で全体がクラッシュする。既定シンボルに退避する。
                    (env.feeToken &&
                      approvedBaseTokens?.find(
                        (token) =>
                          token.address?.toLowerCase() ===
                          env.feeToken.toLowerCase()
                      )?.symbol) ||
                    defaultTokenSymbol
                  }${t('compute.perMinute')}`}
                />
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
