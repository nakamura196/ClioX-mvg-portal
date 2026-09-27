import { useState } from 'react'
import { useAsset } from '@context/Asset'
import Tooltip from '@shared/atoms/Tooltip'
import { decodeTokenURI } from '@utils/nft'
import { useFormikContext } from 'formik'
import { FormPublishData } from '@components/Publish/_types'
import NftTooltip from './NftTooltip'
import styles from './index.module.css'

const defaultImage = '/images/cliox.svg' // Default ClioX logo when no NFT image is available

// ocean.js createAsset() (used by ocean-cli) mints the NFT with tokenURI "aaa",
// which decodeTokenURI() turns into { image: 'aaa' }. Only accept values a
// browser can actually load as an image.
function isImageSrc(value?: string): boolean {
  return /^(data:image\/|https?:\/\/|\/)/.test(value || '')
}

export default function Nft() {
  const { asset } = useAsset()
  const nftMetadata = decodeTokenURI(asset?.nft?.tokenURI)

  // TODO: using this for the publish preview works fine, but produces a console warning
  // on asset details page as there is no formik context there:
  // Warning: Formik context is undefined, please verify you are calling useFormikContext()
  // as child of a <Formik> component.
  const formikState = useFormikContext<FormPublishData>()

  // checking if the NFT has an image associated (tokenURI)
  // if tokenURI is undefined, then we are in Preview
  // for Preview we need to show accessDetails.dataImage
  // as this is where the NFT's SVG (during publish) is stored
  const nftImage =
    [
      nftMetadata?.image_data,
      nftMetadata?.image,
      formikState?.values?.metadata?.nft?.image_data,
      formikState?.values?.metadata?.nft?.image
    ].find(isImageSrc) || defaultImage

  // A valid-looking URL can still fail to load (dead host); fall back then too
  const [failedSrc, setFailedSrc] = useState<string>()
  const imageSrc = failedSrc === nftImage ? defaultImage : nftImage

  return (
    <div className={styles.nftImage}>
      <img
        src={imageSrc}
        alt={asset?.nft?.name || 'ClioX Logo'}
        onError={() => setFailedSrc(nftImage)}
      />

      {(nftMetadata || asset?.nftAddress) && (
        <Tooltip
          className={styles.tooltip}
          content={
            <NftTooltip
              nft={nftMetadata}
              nftImage={imageSrc}
              address={asset?.nftAddress}
              chainId={asset?.chainId}
            />
          }
        />
      )}
    </div>
  )
}
