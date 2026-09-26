import {
  allowFixedPricing,
  customProviderUrl,
  defaultTokenSymbol,
  assetTitlePrefix
} from '../../../app.config'
import {
  FormPublishData,
  MetadataAlgorithmContainer,
  PublishFeedback,
  SAAS_PAYMENT_MODE,
  StepContent
} from './_types'
import content from '../../../content/publish/form.json'
import PricingFields from './Pricing'
import MetadataFields from './Metadata'
import ServicesFields from './Services'
import Preview from './Preview'
import Submission from './Submission'
import { ServiceComputeOptions } from '@oceanprotocol/lib'
import contentFeedback from '../../../content/publish/feedback.json'
import PoliciesFields from './Policies'

/**
 * The wizard's *structure*: step number and the component to render.
 *
 * Deliberately title-free. Titles are the only locale-dependent part of a step,
 * and a module-level constant is evaluated once at import time — long before
 * any React component knows which locale is active — so baking titles in here
 * is what used to pin the whole wizard to English.
 *
 * Read titles through `usePublishWizardSteps()` (see ./_hooks) instead, which
 * layers the active locale's `content/publish/form*.json` on top of this.
 */
export const wizardStepComponents: Omit<StepContent, 'title'>[] = [
  { step: 1, component: <MetadataFields /> },
  { step: 2, component: <ServicesFields /> },
  { step: 3, component: <PoliciesFields /> },
  { step: 4, component: <PricingFields /> },
  { step: 5, component: <Preview /> },
  { step: 6, component: <Submission /> }
]

/**
 * Pulls the six step titles out of a `content/publish/form.json`-shaped object,
 * in wizard order. Works on both the English content and a locale-merged copy.
 */
export function getWizardStepTitles(form: typeof content): string[] {
  return [
    form.metadata.title,
    form.services.title,
    form.policies.title,
    form.pricing.title,
    form.preview.title,
    form.submission.title
  ]
}

/**
 * English wizard steps.
 *
 * Kept as a module constant so non-localized callers (and anything that only
 * needs `.length` or the component for a step) keep working unchanged. Anything
 * that *renders* a title should use `usePublishWizardSteps()`.
 */
export const wizardSteps: StepContent[] = wizardStepComponents.map(
  (step, index) => ({ ...step, title: getWizardStepTitles(content)[index] })
)

const computeOptions: ServiceComputeOptions = {
  allowRawAlgorithm: false,
  allowNetworkAccess: true,
  publisherTrustedAlgorithmPublishers: [],
  publisherTrustedAlgorithms: []
}

export const initialValues: FormPublishData = {
  user: {
    stepCurrent: 1,
    chainId: 32457,
    accountId: ''
  },
  metadata: {
    nft: { name: '', symbol: '', description: '', image_data: '' },
    transferable: true,
    type: 'dataset',
    name: '',
    author: '',
    description: '',
    tags: [assetTitlePrefix],
    termsAndConditions: false,
    dockerImage: '',
    dockerImageCustom: '',
    dockerImageCustomTag: '',
    dockerImageCustomEntrypoint: '',
    usesConsumerParameters: false,
    consumerParameters: [],
    gaiaXInformation: {
      termsAndConditions: [
        {
          url: '',
          type: 'url'
        }
      ],
      containsPII: false,
      PIIInformation: undefined,
      serviceSD: { url: '' }
    },
    saas: {
      paymentMode: SAAS_PAYMENT_MODE.SUBSCRIPTION
    }
  },
  services: [
    {
      files: [{ url: '', type: 'url' }],
      links: [{ url: '', type: 'url' }],
      dataTokenOptions: { name: '', symbol: '' },
      access: 'compute',
      providerUrl: {
        url: customProviderUrl,
        valid: true,
        custom: false
      },
      computeOptions,
      usesConsumerParameters: false,
      consumerParameters: []
    }
  ],
  policies: {
    timeout: '',
    allow: [],
    deny: []
  },
  pricing: {
    baseToken: {
      address: '',
      name: '',
      symbol: defaultTokenSymbol,
      decimals: 18
    },
    price: 0,
    type: allowFixedPricing === 'true' ? 'fixed' : 'free',
    freeAgreement: false
  }
}

export const algorithmContainerPresets: MetadataAlgorithmContainer[] = [
  {
    image: 'node',
    tag: 'latest',
    entrypoint: 'node $ALGO',
    checksum: ''
  },
  {
    image: 'python',
    tag: 'latest',
    entrypoint: 'python $ALGO',
    checksum: ''
  }
]

export const initialPublishFeedback: PublishFeedback = contentFeedback
