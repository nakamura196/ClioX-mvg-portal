import Input from '@shared/FormInput'
import { Field, useFormikContext } from 'formik'
import { ReactElement, useEffect } from 'react'
import IconDownload from '@images/download.svg'
import IconCompute from '@images/compute.svg'
import contentEn from '../../../../content/publish/form.json'
import contentJa from '../../../../content/publish/form.ja.json'
import useLocaleContent from '../../../i18n/useLocaleContent'
import consumerParametersContent from '../../../../content/publish/consumerParameters.json'
import { getFieldContent } from '@utils/form'
import { FormPublishData } from '../_types'
import { useTranslation } from 'react-i18next'

const accessTypeOptionsTitles = getFieldContent(
  'access',
  contentEn.services.fields
).options

export default function ServicesFields(): ReactElement {
  const content = useLocaleContent(contentEn, contentJa)
  const { t } = useTranslation('common')

  // Only the visible title is translated: `name`/`value` stay English because
  // the publish form stores them verbatim as the access type.
  const boxTitle = (title: string) =>
    t(`publish.boxTitles.${title.toLowerCase()}`, { defaultValue: title })
  // connect with Form state, use for conditional field rendering
  const { values, setFieldValue } = useFormikContext<FormPublishData>()

  // name and title should be download, but option value should be access, probably the best way would be to change the component so that option is an object like {name,value}
  const accessTypeOptions = [
    {
      name: 'download',
      value: accessTypeOptionsTitles[0].toLowerCase(),
      title: boxTitle('Download'),
      icon: <IconDownload />,
      // BoxSelection component is not a Formik component
      // so we need to handle checked state manually.
      checked:
        values.services[0].access === accessTypeOptionsTitles[0].toLowerCase()
    },
    {
      name: accessTypeOptionsTitles[1].toLowerCase(),
      value: accessTypeOptionsTitles[1].toLowerCase(),
      title: boxTitle(accessTypeOptionsTitles[1]),
      icon: <IconCompute />,
      checked:
        values.services[0].access === accessTypeOptionsTitles[1].toLowerCase()
    }
  ]

  // Auto-change access type based on algo privacy boolean.
  // Could be also done later in transformPublishFormToDdo().
  useEffect(() => {
    if (
      values.services[0].algorithmPrivacy === null ||
      values.services[0].algorithmPrivacy === undefined
    )
      return

    setFieldValue(
      'services[0].access',
      values.services[0].algorithmPrivacy === true ? 'compute' : 'access'
    )
  }, [values.services[0].algorithmPrivacy, setFieldValue])

  return (
    <>
      <Field
        {...getFieldContent('dataTokenOptions', content.services.fields)}
        component={Input}
        name="services[0].dataTokenOptions"
      />
      {values.metadata.type === 'algorithm' ? (
        <Field
          {...getFieldContent('algorithmPrivacy', content.services.fields)}
          component={Input}
          name="services[0].algorithmPrivacy"
        />
      ) : (
        values.services[0]?.files[0]?.type !== 'saas' && (
          <>
            <Field
              {...getFieldContent('access', content.services.fields)}
              component={Input}
              name="services[0].access"
              options={accessTypeOptions}
            />
          </>
        )
      )}
      <Field
        {...getFieldContent('providerUrl', content.services.fields)}
        component={Input}
        name="services[0].providerUrl"
      />
      {values.services[0]?.files[0]?.type === 'saas' ? (
        <>
          <Field
            {...getFieldContent('redirectUrl', content.services.fields)}
            component={Input}
            name="services[0].files[0].url"
          />
          <Field
            {...getFieldContent('paymentMode', content.services.fields)}
            component={Input}
            name="metadata.saas.paymentMode"
          />
        </>
      ) : (
        <Field
          {...getFieldContent('files', content.services.fields)}
          component={Input}
          name="services[0].files"
        />
      )}
      {values.services[0]?.files[0]?.type !== 'saas' && (
        <Field
          {...getFieldContent('links', content.services.fields)}
          component={Input}
          name="services[0].links"
        />
      )}

      <Field
        {...getFieldContent('usesConsumerParameters', content.services.fields)}
        component={Input}
        name="services[0].usesConsumerParameters"
      />
      {values.services[0].usesConsumerParameters && (
        <Field
          {...getFieldContent(
            'consumerParameters',
            consumerParametersContent.consumerParameters.fields
          )}
          component={Input}
          name="services[0].consumerParameters"
        />
      )}
    </>
  )
}
