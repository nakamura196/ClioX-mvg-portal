import { ReactElement, useCallback, useEffect, useState } from 'react'
import { useFormikContext } from 'formik'
import Tabs from '@shared/atoms/Tabs'
import { FormPublishData } from '../_types'
import Fixed from './Fixed'
import Free from './Free'
import contentEn from '../../../../content/price.json'
import contentJa from '../../../../content/price.ja.json'
import useLocaleContent from '../../../i18n/useLocaleContent'
import styles from './index.module.css'
import { useMarketMetadata } from '@context/MarketMetadata'
import { useNetwork } from 'wagmi'

export default function PricingFields(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const {
    appConfig: { allowFixedPricing, allowFreePricing, defaultTokenSymbol }
  } = useMarketMetadata()
  const { chain } = useNetwork()
  const { approvedBaseTokens } = useMarketMetadata()

  // Connect with main publish form
  const { values, setFieldValue } = useFormikContext<FormPublishData>()
  const { pricing } = values
  const { type } = pricing

  const defaultBaseToken =
    approvedBaseTokens?.find((token) =>
      token.name.toLowerCase().includes(defaultTokenSymbol.toLowerCase())
    ) || approvedBaseTokens?.[0]

  const isBaseTokenSet = !!approvedBaseTokens?.find(
    (token) => token?.address === values?.pricing?.baseToken?.address
  )

  useEffect(() => {
    if (!approvedBaseTokens?.length) return
    if (isBaseTokenSet) return
    setFieldValue('pricing.baseToken', defaultBaseToken)
  }, [
    approvedBaseTokens,
    chain?.id,
    defaultBaseToken,
    isBaseTokenSet,
    setFieldValue,
    values.pricing.baseToken
  ])

  // Switch type value upon tab change.
  // `tabValue` is the tab's locale-independent `value` ('fixed' | 'free'), not
  // its visible title: the titles are translated, so keying off them used to
  // store `有料` / `無料` in `pricing.type` on /ja and fail the
  // `matches(/fixed|free/)` check in _validation.ts.
  function handleTabChange(tabValue: string) {
    const type = tabValue
    setFieldValue('pricing.type', type)
    setFieldValue('pricing.price', 0)
    setFieldValue('pricing.freeAgreement', false)
    setFieldValue('pricing.baseToken', defaultBaseToken)
    type !== 'free' && setFieldValue('pricing.amountDataToken', 1000)
  }

  const updateTabs = useCallback(() => {
    return [
      allowFixedPricing === 'true'
        ? {
            title: content.create.fixed.title,
            value: 'fixed',
            content: (
              <Fixed
                approvedBaseTokens={approvedBaseTokens}
                content={content.create.fixed}
              />
            )
          }
        : undefined,

      allowFreePricing === 'true'
        ? {
            title: content.create.free.title,
            value: 'free',
            content: <Free content={content.create.free} />
          }
        : undefined
    ].filter((tab) => tab !== undefined)
  }, [allowFixedPricing, allowFreePricing, approvedBaseTokens])

  const [tabs, setTabs] = useState(updateTabs())
  const [tabIndex, setTabIndex] = useState(type === 'free' ? 1 : 0)

  useEffect(() => {
    setTabs(updateTabs())
  }, [updateTabs])

  return (
    <Tabs
      items={tabs}
      handleTabChange={handleTabChange}
      selectedIndex={tabIndex}
      onIndexSelected={setTabIndex}
      className={styles.pricing}
      showRadio
    />
  )
}
