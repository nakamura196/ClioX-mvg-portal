import tourEn from '../../../content/firstRunTour.json'

export type TourStepId = keyof (typeof tourEn)['steps']

/**
 * One real archival dataset the whole tour walks through: the Federalist
 * Papers, published as a compute-only dataset on the trial node (Sepolia).
 * It must exist on the node this portal reads (NEXT_PUBLIC_METADATACACHE_URI);
 * the earlier InterPARES DID lived only on Pontus-X devnet, so the asset page
 * was empty on the trial and the tour lost its targets from step 4 on.
 */
export const SAMPLE_ASSET_PATH =
  '/asset/did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c'

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
