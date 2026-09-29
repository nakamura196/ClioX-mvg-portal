import tourEn from '../../../content/firstRunTour.json'

export type TourStepId = keyof (typeof tourEn)['steps']

/**
 * One real archival dataset the whole tour walks through: the InterPARES
 * terminology, published as a compute-only dataset on Pontus-X devnet.
 */
export const SAMPLE_ASSET_PATH =
  '/asset/did:op:65e78d531a723c249afd18d1045dcb312912356b8b5fbf7f772287c3548bf43d'

export interface TourStep {
  id: TourStepId
  /**
   * Page the step lives on (without locale prefix). Omitted = any page, e.g.
   * header items. The tour navigates here before looking for the target.
   */
  path?: string
  /**
   * CSS selectors for what to highlight. The spotlight covers all matches.
   * Omitted = a centred card with nothing highlighted.
   */
  target?: string[]
}

// Targets use `data-tour` attributes added to the existing components, or
// form field names, never CSS-module class names (those are hashed).
const access = '[data-tour="asset-access"] form'

export const tourSteps: TourStep[] = [
  { id: 'welcome' },
  { id: 'catalogue', target: ['[data-tour="catalogue"]'] },
  { id: 'search', path: '/search', target: ['[data-tour="search"]'] },
  {
    id: 'record',
    path: SAMPLE_ASSET_PATH,
    target: ['main h1', '[data-tour="asset-record"]']
  },
  {
    id: 'custody',
    path: SAMPLE_ASSET_PATH,
    target: ['[data-tour="asset-custody"]']
  },
  {
    id: 'identifiers',
    path: SAMPLE_ASSET_PATH,
    target: ['[data-tour="asset-identifiers"]']
  },
  {
    id: 'access',
    path: SAMPLE_ASSET_PATH,
    target: ['[data-tour="asset-access"]']
  },
  {
    id: 'environment',
    path: SAMPLE_ASSET_PATH,
    target: [`${access} > div:has(input[name="computeEnv"])`]
  },
  {
    id: 'algorithm',
    path: SAMPLE_ASSET_PATH,
    target: [
      `${access} > div:has(input[name="algorithm"])`,
      `${access} > div:has(input[name="assetSearch"])`
    ]
  },
  {
    id: 'startJob',
    path: SAMPLE_ASSET_PATH,
    target: [
      `${access} > div:has(button[type="submit"])`,
      `${access} > div:has(input[name="portalTermsAndConditions"])`,
      `${access} > div:has(input[name="assetTermsAndConditions"])`
    ]
  },
  { id: 'wallet', target: ['[data-tour="wallet"]'] },
  { id: 'finish' }
]

/** Does the current route (Next's `asPath`, locale already stripped) match? */
export function isOnStepPage(step: TourStep, asPath: string): boolean {
  if (!step.path) return true
  const current = decodeURIComponent(asPath.split(/[?#]/)[0])
  return current === step.path || current.startsWith(`${step.path}/`)
}
