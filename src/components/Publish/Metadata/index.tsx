import { BoxSelectionOption } from '@shared/FormInput/InputElement/BoxSelection'
import Input from '@shared/FormInput'
import { Field, useField, useFormikContext } from 'formik'
import { ReactElement, useEffect } from 'react'
import contentEn from '../../../../content/publish/form.json'
import contentJa from '../../../../content/publish/form.ja.json'
import useLocaleContent from '../../../i18n/useLocaleContent'
import consumerParametersContent from '../../../../content/publish/consumerParameters.json'
import { FormPublishData } from '../_types'
import IconDataset from '@images/dataset.svg'
import IconAlgorithm from '@images/algorithm.svg'
import IconSaas from '@images/saas.svg'
import styles from './index.module.css'
import { algorithmContainerPresets } from '../_constants'
import { useMarketMetadata } from '@context/MarketMetadata'
import { getFieldContent } from '@utils/form'
import { useTranslation } from 'react-i18next'

const assetTypeOptionsTitles = getFieldContent(
  'type',
  contentEn.metadata.fields
).options

export default function MetadataFields(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const { t } = useTranslation('common')

  // Only the visible title is translated: `name`/`value` stay English because
  // the publish form stores them verbatim as the asset type / access type.
  const boxTitle = (title: string) =>
    t(`publish.boxTitles.${title.toLowerCase()}`, { defaultValue: title })
  const { siteContent, appConfig } = useMarketMetadata()

  // connect with Form state, use for conditional field rendering
  const { values, setFieldValue } = useFormikContext<FormPublishData>()

  const [field, meta] = useField('metadata.dockerImageCustomChecksum')

  // BoxSelection component is not a Formik component
  // so we need to handle checked state manually.
  const assetTypeOptions: BoxSelectionOption[] = [
    {
      name: assetTypeOptionsTitles[0].toLowerCase(),
      title: boxTitle(assetTypeOptionsTitles[0]),
      checked:
        values.metadata.type === assetTypeOptionsTitles[0].toLowerCase() &&
        values.services[0]?.files[0]?.type !== 'saas',
      icon: <IconDataset />
    },
    {
      name: assetTypeOptionsTitles[1].toLowerCase(),
      title: boxTitle(assetTypeOptionsTitles[1]),
      checked: values.metadata.type === assetTypeOptionsTitles[1].toLowerCase(),
      icon: <IconAlgorithm />
    },
    {
      name: assetTypeOptionsTitles[2].toLowerCase(),
      title: boxTitle(assetTypeOptionsTitles[2]),
      checked:
        values.metadata.type === assetTypeOptionsTitles[0].toLowerCase() &&
        values.services[0]?.files[0]?.type === 'saas',
      icon: <IconSaas />
    }
  ]

  // Populate the Docker image field with our presets in _constants,
  // transformPublishFormToDdo will do the rest.
  const dockerImageOptions: BoxSelectionOption[] =
    algorithmContainerPresets.map((preset) => ({
      name: `${preset.image}:${preset.tag}`,
      title: `${preset.image}:${preset.tag}`,
      checked: values.metadata.dockerImage === `${preset.image}:${preset.tag}`
    }))

  useEffect(() => {
    setFieldValue(
      'services[0].access',
      values.metadata.type === 'algorithm' ? 'compute' : 'access'
    )
    setFieldValue(
      'services[0].algorithmPrivacy',
      values.metadata.type === 'algorithm'
    )
  }, [values.metadata.type])

  dockerImageOptions.push({ name: 'custom', title: 'Custom', checked: false })

  return (
    <>
      <Field
        {...getFieldContent('nft', content.metadata.fields)}
        component={Input}
        name="metadata.nft"
      />
      <Field
        {...getFieldContent('type', content.metadata.fields)}
        component={Input}
        name="metadata.type"
        options={assetTypeOptions}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          if (event.target.value === 'saas') {
            setFieldValue('metadata.type', 'dataset')
            setFieldValue('services[0].files[0].type', 'saas')
          } else {
            setFieldValue('services[0].files[0].type', 'url')
            setFieldValue('metadata.type', event.target.value)
          }
        }}
      />
      <Field
        {...getFieldContent('name', content.metadata.fields)}
        component={Input}
        name="metadata.name"
        prefix={appConfig?.assetTitlePrefix}
        help={
          appConfig?.assetTitlePrefix
            ? `Will publish as: ${appConfig.assetTitlePrefix} ${
                appConfig?.assetTitleSeparator || '-'
              } [Your Title]. You don't need to type the prefix.`
            : undefined
        }
      />
      <Field
        {...getFieldContent('description', content.metadata.fields)}
        component={Input}
        name="metadata.description"
        rows={7}
      />
      <Field
        {...getFieldContent('author', content.metadata.fields)}
        component={Input}
        name="metadata.author"
      />
      <Field
        {...getFieldContent('serviceCredential', content.metadata.fields)}
        component={Input}
        name="metadata.gaiaXInformation.serviceSD"
      />
      <Field
        {...getFieldContent('tags', content.metadata.fields)}
        component={Input}
        name="metadata.tags"
      />

      {values.metadata.type === 'algorithm' && (
        <>
          <Field
            {...getFieldContent('dockerImage', content.metadata.fields)}
            component={Input}
            name="metadata.dockerImage"
            options={dockerImageOptions}
          />
          {values.metadata.dockerImage === 'custom' && (
            <>
              <Field
                {...getFieldContent(
                  'dockerImageCustom',
                  content.metadata.fields
                )}
                component={Input}
                name="metadata.dockerImageCustom"
              />
              <Field
                {...getFieldContent(
                  'dockerImageChecksum',
                  content.metadata.fields
                )}
                component={Input}
                name="metadata.dockerImageCustomChecksum"
                disabled={
                  values.metadata.dockerImageCustomChecksum && !meta.touched
                }
              />
              <Field
                {...getFieldContent(
                  'dockerImageCustomEntrypoint',
                  content.metadata.fields
                )}
                component={Input}
                name="metadata.dockerImageCustomEntrypoint"
              />
            </>
          )}
          <Field
            {...getFieldContent(
              'usesConsumerParameters',
              content.metadata.fields
            )}
            component={Input}
            name="metadata.usesConsumerParameters"
          />
          {values.metadata.usesConsumerParameters && (
            <Field
              {...getFieldContent(
                'consumerParameters',
                consumerParametersContent.consumerParameters.fields
              )}
              component={Input}
              name="metadata.consumerParameters"
            />
          )}
        </>
      )}

      {values.metadata.type === 'dataset' && (
        <>
          <Field
            {...getFieldContent('containsPII', content.metadata.fields)}
            component={Input}
            name="metadata.gaiaXInformation.containsPII"
          />

          {values.metadata.gaiaXInformation.containsPII === true && (
            <div className={styles.gdpr}>
              <Field
                {...getFieldContent('dataController', content.metadata.fields)}
                component={Input}
                name="metadata.gaiaXInformation.PIIInformation.legitimateProcessing.dataController"
              />

              <Field
                {...getFieldContent('legalBasis', content.metadata.fields)}
                component={Input}
                name="metadata.gaiaXInformation.PIIInformation.legitimateProcessing.legalBasis"
              />

              <Field
                {...getFieldContent('purpose', content.metadata.fields)}
                component={Input}
                name="metadata.gaiaXInformation.PIIInformation.legitimateProcessing.purpose"
              />

              <Field
                {...getFieldContent(
                  'dataProtectionContactPoint',
                  content.metadata.fields
                )}
                component={Input}
                name="metadata.gaiaXInformation.PIIInformation.legitimateProcessing.dataProtectionContactPoint"
              />

              <Field
                {...getFieldContent(
                  'consentWithdrawalContactPoint',
                  content.metadata.fields
                )}
                component={Input}
                name="metadata.gaiaXInformation.PIIInformation.legitimateProcessing.consentWithdrawalContactPoint"
              />
            </div>
          )}
        </>
      )}

      <Field
        {...getFieldContent('termsAndConditions', content.metadata.fields)}
        component={Input}
        name="metadata.termsAndConditions"
      />
    </>
  )
}
