import { useTranslation } from 'react-i18next'
import { ReactElement, useEffect, useState } from 'react'
import Tooltip from '@shared/atoms/Tooltip'
import styles from './Fees.module.css'
import Input from '@shared/FormInput'
import { getOpcFees } from '@utils/subgraph'
import { OpcFeesQuery_opc as OpcFeesData } from '../../../@types/subgraph/OpcFeesQuery'
import { useMarketMetadata } from '@context/MarketMetadata'
import Decimal from 'decimal.js'
import { useNetwork } from 'wagmi'

const Default = ({
  title,
  name,
  tooltip,
  value
}: {
  title: string
  name: string
  tooltip: string
  value: string
}) => (
  <Input
    label={
      <>
        {title}
        <Tooltip content={tooltip} />
      </>
    }
    value={value}
    name={name}
    postfixes={['%']}
    readOnly
    size="small"
  />
)

export default function Fees({
  tooltips,
  assetPrice
}: {
  tooltips: { [key: string]: string }
  assetPrice: number
}): ReactElement {
  const [oceanCommunitySwapFee, setOceanCommunitySwapFee] = useState<string>('')
  const { chain } = useNetwork()
  const { t } = useTranslation('common')
  const { appConfig } = useMarketMetadata()

  useEffect(() => {
    getOpcFees(chain?.id || 32457).then((response: OpcFeesData) => {
      setOceanCommunitySwapFee(
        response?.swapOceanFee
          ? new Decimal(response.swapOceanFee).mul(100).toString()
          : '0'
      )
    })
  }, [chain?.id])

  const earningsAfterFees =
    !assetPrice || assetPrice <= 0
      ? 0
      : assetPrice -
        (assetPrice * Number(oceanCommunitySwapFee)) / 100 -
        (assetPrice * Number(appConfig?.publisherMarketFixedSwapFee || 0)) / 100

  return (
    <>
      <div className={styles.fees}>
        <Default
          title={t('publish.fees.community')}
          name="communityFee"
          tooltip={tooltips.communityFee}
          value={oceanCommunitySwapFee}
        />

        <Default
          title={t('publish.fees.marketplace')}
          name="marketplaceFee"
          tooltip={tooltips.marketplaceFee}
          value={appConfig?.publisherMarketFixedSwapFee}
        />

        <Default
          title={t('publish.fees.earnings')}
          name="earningsAfterFees"
          tooltip={tooltips.earningsAfterFees}
          value={earningsAfterFees.toString()}
        />
      </div>
    </>
  )
}
