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
import { Fragment, useEffect } from 'react'
import { setDemoSelected } from '@experiment/footprint/demoEnvs' // [prototype]
import { useArchivistMode } from '@experiment/archivist/context' // [prototype]

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
  const { archivistMode } = useArchivistMode()
  const {
    approvedBaseTokens,
    appConfig: { defaultTokenSymbol }
  } = useMarketMetadata()
  // [prototype] デモの見本環境（?demo=1）を選んだら、情報カードの下の比較表に伝える
  useEffect(() => {
    // 左の比較表（見本の ?demo=1 と、本物の環境が 2 つ以上のとき）と選択を揃える
    if (computeEnvs?.some((e) => e.id === selected)) setDemoSelected(selected)
  }, [computeEnvs, selected])

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
            <Fragment key={env.id}>
              <div className={styles.row}>
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
                  htmlFor={slugify(env.description || env.desc || env.id)}
                  title={env.description || env.desc || env.id}
                >
                  {/* 3.2.0 は description、3.1.3 は desc。両方見ないと id(ハッシュ)が出る。 */}
                  <h3 className={assetSelectionStyles.title}>
                    <Dotdotdot clamp={1} tagName="span">
                      {env.description || env.desc || env.id}
                    </Dotdotdot>
                    <Tooltip content={<ComputeEnvDetails computeEnv={env} />} />
                  </h3>
                  <Dotdotdot
                    clamp={1}
                    tagName="code"
                    className={styles.details}
                  >
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
                  {/* [prototype] ?demo=1 の見本の環境は、左の比較表と同じ見本の費用を出す */}
                  {(env as any).trialOption ? (
                    <span className={assetSelectionStyles.price}>
                      USD {(env as any).trialOption.costUSD.toFixed(2)}
                    </span>
                  ) : archivistMode && !(Number(env.priceMin) > 0) ? (
                    <span className={assetSelectionStyles.price}>
                      {t('price.free')}
                    </span>
                  ) : (
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
                  )}
                </label>
              </div>
            </Fragment>
          ))
        )}
      </div>
    </div>
  )
}
