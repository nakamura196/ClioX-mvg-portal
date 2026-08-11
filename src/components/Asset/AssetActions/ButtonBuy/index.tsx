import { FormEvent, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import Button from '../../../@shared/atoms/Button'
import Loader from '../../../@shared/atoms/Loader'
import { PAYMENT_MODES, PaymentMode } from '../Download/ContractingProvider'
import styles from './index.module.css'

export interface ButtonBuyProps {
  action: 'download' | 'compute'
  disabled: boolean
  hasPreviousOrder: boolean
  hasDatatoken: boolean
  btSymbol: string
  dtSymbol: string
  dtBalance: string
  assetType: string
  assetTimeout: string
  isConsumable: boolean
  consumableFeedback: string
  hasPreviousOrderSelectedComputeAsset?: boolean
  hasDatatokenSelectedComputeAsset?: boolean
  dtSymbolSelectedComputeAsset?: string
  dtBalanceSelectedComputeAsset?: string
  selectedComputeAssetType?: string
  isBalanceSufficient: boolean
  isLoading?: boolean
  onClick?: (e: FormEvent<HTMLButtonElement>) => void
  stepText?: string
  type?: 'submit'
  priceType?: string
  algorithmPriceType?: string
  isAlgorithmConsumable?: boolean
  isSupportedOceanNetwork?: boolean
  isAccountConnected?: boolean
  hasProviderFee?: boolean
  retry?: boolean
  paymentMode?: PaymentMode
}

// `assetType` はコード上の値 ('dataset' / 'algorithm' / 'saas') なので、
// 文面に埋め込む前に必ず訳語に置き換える。
function localizedType(t: TFunction, type: string): string {
  return t(`assetType.${type || 'dataset'}`)
}

function getConsumeHelpText(
  t: TFunction,
  btSymbol: string,
  dtBalance: string,
  dtSymbol: string,
  hasDatatoken: boolean,
  hasPreviousOrder: boolean,
  assetType: string,
  isConsumable: boolean,
  isBalanceSufficient: boolean,
  consumableFeedback: string,
  isSupportedOceanNetwork: boolean,
  isAccountConnected: boolean,
  priceType: string
) {
  const text =
    isConsumable === false
      ? consumableFeedback
      : hasPreviousOrder && isAccountConnected && isSupportedOceanNetwork
      ? t('buy.alreadyBought', { type: localizedType(t, assetType) })
      : hasDatatoken
      ? t('buy.ownDatatoken', { balance: dtBalance, dtSymbol, btSymbol })
      : isBalanceSufficient === false
      ? t('buy.insufficientBalance', { btSymbol })
      : priceType === 'free'
      ? t('buy.freeToUse', { type: localizedType(t, assetType) })
      : t('buy.willBuyDatatoken', {
          type: localizedType(t, assetType),
          dtSymbol
        })
  return text
}

function getAlgoHelpText(
  t: TFunction,
  dtSymbolSelectedComputeAsset: string,
  dtBalanceSelectedComputeAsset: string,
  isConsumable: boolean,
  isAlgorithmConsumable: boolean,
  hasPreviousOrderSelectedComputeAsset: boolean,
  selectedComputeAssetType: string,
  hasDatatokenSelectedComputeAsset: boolean,
  isBalanceSufficient: boolean,
  isSupportedOceanNetwork: boolean,
  isAccountConnected: boolean,
  algorithmPriceType: string
) {
  const text =
    (!dtSymbolSelectedComputeAsset && !dtBalanceSelectedComputeAsset) ||
    isConsumable === false ||
    isAlgorithmConsumable === false
      ? ''
      : hasPreviousOrderSelectedComputeAsset &&
        isAccountConnected &&
        isSupportedOceanNetwork
      ? t('buy.algoAlreadyBought', {
          type: localizedType(t, selectedComputeAssetType)
        })
      : hasDatatokenSelectedComputeAsset
      ? t('buy.algoOwnDatatoken', {
          balance: dtBalanceSelectedComputeAsset,
          dtSymbol: dtSymbolSelectedComputeAsset,
          type: localizedType(t, selectedComputeAssetType)
        })
      : isAccountConnected && !isSupportedOceanNetwork
      ? t('buy.wrongNetwork')
      : isBalanceSufficient === false
      ? ''
      : algorithmPriceType === 'free'
      ? t('buy.algoFree', { type: localizedType(t, selectedComputeAssetType) })
      : t('buy.algoWillBuy', {
          dtSymbol: dtSymbolSelectedComputeAsset,
          type: localizedType(t, selectedComputeAssetType)
        })
  return text
}

function getComputeAssetHelpText(
  t: TFunction,
  hasPreviousOrder: boolean,
  hasDatatoken: boolean,
  btSymbol: string,
  dtSymbol: string,
  dtBalance: string,
  isConsumable: boolean,
  consumableFeedback: string,
  isBalanceSufficient: boolean,
  algorithmPriceType: string,
  priceType: string,
  hasPreviousOrderSelectedComputeAsset?: boolean,
  hasDatatokenSelectedComputeAsset?: boolean,
  assetType?: string,
  dtSymbolSelectedComputeAsset?: string,
  dtBalanceSelectedComputeAsset?: string,
  selectedComputeAssetType?: string,
  isAlgorithmConsumable?: boolean,
  isSupportedOceanNetwork?: boolean,
  isAccountConnected?: boolean,
  hasProviderFee?: boolean
) {
  const computeAssetHelpText = getConsumeHelpText(
    t,
    btSymbol,
    dtBalance,
    dtSymbol,
    hasDatatoken,
    hasPreviousOrder,
    assetType,
    isConsumable,
    isBalanceSufficient,
    consumableFeedback,
    isSupportedOceanNetwork,
    isAccountConnected,
    priceType
  )

  const computeAlgoHelpText = getAlgoHelpText(
    t,
    dtSymbolSelectedComputeAsset,
    dtBalanceSelectedComputeAsset,
    isConsumable,
    isAlgorithmConsumable,
    hasPreviousOrderSelectedComputeAsset,
    selectedComputeAssetType,
    hasDatatokenSelectedComputeAsset,
    isBalanceSufficient,
    isSupportedOceanNetwork,
    isAccountConnected,
    algorithmPriceType
  )

  const providerFeeHelpText = hasProviderFee
    ? t('buy.providerFeeRequired')
    : t('buy.providerFeeFree')
  let computeHelpText = `${computeAssetHelpText} ${computeAlgoHelpText} ${providerFeeHelpText}`

  computeHelpText = computeHelpText.replace(/^\s+/, '')
  return computeHelpText
}

export default function ButtonBuy({
  action,
  disabled,
  hasPreviousOrder,
  hasDatatoken,
  btSymbol,
  dtSymbol,
  dtBalance,
  assetType,
  paymentMode,
  assetTimeout,
  isConsumable,
  consumableFeedback,
  isBalanceSufficient,
  hasPreviousOrderSelectedComputeAsset,
  hasDatatokenSelectedComputeAsset,
  dtSymbolSelectedComputeAsset,
  dtBalanceSelectedComputeAsset,
  selectedComputeAssetType,
  onClick,
  stepText,
  isLoading,
  type,
  priceType,
  algorithmPriceType,
  isAlgorithmConsumable,
  hasProviderFee,
  retry,
  isSupportedOceanNetwork,
  isAccountConnected
}: ButtonBuyProps): ReactElement {
  const { t } = useTranslation('common')

  const buttonText = retry
    ? t('actions.retry')
    : action === 'download'
    ? hasPreviousOrder && assetType === 'saas'
      ? paymentMode === PAYMENT_MODES.PAYPERUSE
        ? t('buy.buyAccessCredit')
        : t('buy.goToService')
      : hasPreviousOrder
      ? t('buy.download')
      : priceType === 'free'
      ? t('buy.get')
      : assetType === 'saas'
      ? paymentMode === PAYMENT_MODES.PAYPERUSE
        ? t('buy.buyAccessCredit')
        : assetTimeout === 'Forever'
        ? t('buy.subscribe')
        : t('buy.subscribeFor', { timeout: assetTimeout })
      : assetTimeout === 'Forever'
      ? t('buy.buy')
      : t('buy.buyFor', { timeout: assetTimeout })
    : hasPreviousOrder &&
      hasPreviousOrderSelectedComputeAsset &&
      !hasProviderFee
    ? t('compute.startJob')
    : priceType === 'free' && algorithmPriceType === 'free'
    ? t('compute.orderJob')
    : t('compute.buyJob')

  function message(): string {
    let message = ''
    if (action === 'download') {
      message = getConsumeHelpText(
        t,
        btSymbol,
        dtBalance,
        dtSymbol,
        hasDatatoken,
        hasPreviousOrder,
        assetType,
        isConsumable,
        isBalanceSufficient,
        consumableFeedback,
        isSupportedOceanNetwork,
        isAccountConnected,
        priceType
      )
    } else {
      message = getComputeAssetHelpText(
        t,
        hasPreviousOrder,
        hasDatatoken,
        btSymbol,
        dtSymbol,
        dtBalance,
        isConsumable,
        consumableFeedback,
        isBalanceSufficient,
        algorithmPriceType,
        priceType,
        hasPreviousOrderSelectedComputeAsset,
        hasDatatokenSelectedComputeAsset,
        assetType,
        dtSymbolSelectedComputeAsset,
        dtBalanceSelectedComputeAsset,
        selectedComputeAssetType,
        isAlgorithmConsumable,
        isSupportedOceanNetwork,
        isAccountConnected,
        hasProviderFee
      )
    }
    if (priceType === 'free' || algorithmPriceType === 'free') {
      message += ` ${t('buy.gasFeeNote')}`
    }
    return message
  }
  return (
    <div className={styles.actions}>
      {isLoading ? (
        <Loader message={stepText} />
      ) : (
        <>
          <Button
            style="primary"
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={action === 'compute' ? styles.actionsCenter : ''}
          >
            {buttonText}
          </Button>
          <div className={styles.help}>{message()}</div>
        </>
      )}
    </div>
  )
}
