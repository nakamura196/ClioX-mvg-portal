import { FileInfo } from '@oceanprotocol/lib'
import { MAX_DECIMALS } from '@utils/constants'
import { getMaxDecimalsValidation } from '@utils/numbers'
import * as Yup from 'yup'
import { testLinks } from '@utils/yup'
import { validationConsumerParameters } from '@components/@shared/FormInput/InputElement/ConsumerParameters/_validation'

// TODO: conditional validation
// e.g. when algo is selected, Docker image is required
// hint, hint: https://github.com/jquense/yup#mixedwhenkeys-string--arraystring-builder-object--value-schema-schema-schema

/**
 * Translator signature accepted by `getValidationSchema`.
 *
 * Matches the `t` returned by `useTranslation('common')`, but is typed
 * structurally so this module stays free of a react-i18next import and can
 * still be built (in English) outside a React tree.
 */
export type ValidationTranslate = (
  key: string,
  options?: Record<string, unknown>
) => string

/** English fallback used when no translator is supplied. */
const defaultMessages: Record<string, string> = {
  'publish.validation.required': 'Required',
  'publish.validation.titleMin': 'Title must be at least {{min}} characters',
  'publish.validation.descriptionMin':
    'Description must be at least {{min}} characters',
  'publish.validation.descriptionMax':
    'Description must have maximum {{max}} characters',
  'publish.validation.agreeTerms': 'Please agree to the Terms and Conditions.',
  'publish.validation.fileMustBeValid': 'File must be valid.',
  'publish.validation.atLeastOneFile': 'At least one file is required.',
  'publish.validation.enterValidUrlAddFile':
    'Enter a valid URL and click ADD FILE.',
  'publish.validation.mustBeValidUrl': 'Must be a valid URL.',
  'publish.validation.validProviderRequired': 'Valid Provider is required.',
  'publish.validation.priceMin': 'Must be more or equal to {{min}}',
  'publish.validation.priceMax': 'Must be less than or equal to {{max}}',
  'publish.validation.maxDecimals': 'Must have maximum {{max}} decimal digits'
}

const fallbackTranslate: ValidationTranslate = (key, options) =>
  Object.entries(options || {}).reduce(
    (message, [name, value]) =>
      message.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), String(value)),
    defaultMessages[key] ?? key
  )

/**
 * Builds the publish form's Yup schema with messages in the active locale.
 *
 * Yup bakes its messages in when the schema is constructed, so a module-level
 * schema is permanently English. Call this from a component (see
 * `usePublishValidationSchema`) so `/ja` gets Japanese validation errors.
 *
 * Note the regex `matches()` checks below deliberately keep their English
 * alternatives (`dataset|algorithm|saas`, `fixed|free`, `compute|access`):
 * those test stored form *values*, not anything the user reads.
 */
export function getValidationSchema(
  translate: ValidationTranslate = fallbackTranslate
): Yup.SchemaOf<any> {
  const t = translate
  const required = () => t('publish.validation.required')

  const validationMetadata = {
    type: Yup.string()
      .matches(/dataset|algorithm|saas/g, { excludeEmptyString: true })
      .required(required()),
    name: Yup.string()
      .min(4, (param) => t('publish.validation.titleMin', { min: param.min }))
      .required(required()),
    description: Yup.string()
      .min(10, (param) =>
        t('publish.validation.descriptionMin', { min: param.min })
      )
      .max(5000, (param) =>
        t('publish.validation.descriptionMax', { max: param.max })
      )
      .required(required()),
    tags: Yup.array<string[]>().nullable(),
    dockerImage: Yup.string().when('type', {
      is: 'algorithm',
      then: Yup.string().required(required())
    }),
    dockerImageCustomChecksum: Yup.string().when('type', {
      is: 'algorithm',
      then: Yup.string().when('dockerImage', {
        is: 'custom',
        then: Yup.string().required(required())
      })
    }),
    dockerImageCustomEntrypoint: Yup.string().when('type', {
      is: 'algorithm',
      then: Yup.string().when('dockerImage', {
        is: 'custom',
        then: Yup.string().required(required())
      })
    }),
    termsAndConditions: Yup.boolean()
      .required(required())
      .isTrue(t('publish.validation.agreeTerms')),
    usesConsumerParameters: Yup.boolean(),
    consumerParameters: Yup.array().when('type', {
      is: 'algorithm',
      then: Yup.array().when('usesConsumerParameters', {
        is: true,
        then: Yup.array()
          .of(Yup.object().shape(validationConsumerParameters))
          .required(required()),
        otherwise: Yup.array()
          .nullable()
          .transform((value) => value || null)
      })
    })
  }

  const validationService = {
    files: Yup.array<FileInfo[]>()
      .of(
        Yup.object().shape({
          url: testLinks(),
          valid: Yup.boolean().when('type', {
            is: 'saas',
            then: Yup.boolean().notRequired(),
            otherwise: Yup.boolean()
              .isTrue()
              .required(t('publish.validation.fileMustBeValid'))
          })
        })
      )
      .min(1, t('publish.validation.atLeastOneFile'))
      .required(t('publish.validation.enterValidUrlAddFile')),
    links: Yup.array<FileInfo[]>()
      .of(
        Yup.object().shape({
          url: testLinks(),
          valid: Yup.boolean()
        })
      )
      .nullable(),
    dataTokenOptions: Yup.object().shape({
      name: Yup.string(),
      symbol: Yup.string()
    }),
    access: Yup.string()
      .matches(/compute|access/g)
      .required(required()),
    providerUrl: Yup.object().shape({
      url: Yup.string()
        .url(t('publish.validation.mustBeValidUrl'))
        .required(required()),
      valid: Yup.boolean()
        .isTrue()
        .required(t('publish.validation.validProviderRequired')),
      custom: Yup.boolean()
    }),
    usesConsumerParameters: Yup.boolean(),
    consumerParameters: Yup.array().when('usesConsumerParameters', {
      is: true,
      then: Yup.array()
        .of(Yup.object().shape(validationConsumerParameters))
        .required(required()),
      otherwise: Yup.array()
        .nullable()
        .transform((value) => value || null)
    })
  }

  const validationPolicies = {
    timeout: Yup.string().required(required()),
    allow: Yup.array().of(Yup.string()).nullable(),
    deny: Yup.array().of(Yup.string()).nullable()
  }

  const validationPricing = {
    type: Yup.string()
      .matches(/fixed|free/g, { excludeEmptyString: true })
      .required(required()),
    price: Yup.number()
      .min(1, (param: { min: number }) =>
        t('publish.validation.priceMin', { min: param.min })
      )
      .max(1000000, (param: { max: number }) =>
        t('publish.validation.priceMax', { max: param.max })
      )
      .test(
        'maxDigitsAfterDecimal',
        t('publish.validation.maxDecimals', { max: MAX_DECIMALS }),
        (param) =>
          getMaxDecimalsValidation(MAX_DECIMALS).test(param?.toString())
      )
      .required(required())
  }

  // TODO: make Yup.SchemaOf<FormPublishData> work, requires conditional
  // validation of all the custom docker image stuff.
  return Yup.object().shape({
    user: Yup.object().shape({
      stepCurrent: Yup.number(),
      chainId: Yup.number().required(required()),
      accountId: Yup.string().required(required())
    }),
    metadata: Yup.object().shape(validationMetadata),
    services: Yup.array().of(Yup.object().shape(validationService)),
    policies: Yup.object().shape(validationPolicies),
    pricing: Yup.object().shape(validationPricing)
  })
}

/**
 * English publish validation schema.
 *
 * Kept so existing non-React importers keep working unchanged. Components
 * should use `usePublishValidationSchema()` from ./_hooks to get the active
 * locale's messages.
 */
export const validationSchema: Yup.SchemaOf<any> = getValidationSchema()
