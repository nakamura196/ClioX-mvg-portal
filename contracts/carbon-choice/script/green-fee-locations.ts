/**
 * Prints the GreenFeeDemo price table from the portal's own location registry
 * (src/@utils/computeFootprint.ts), so the contract and the page use the same
 * numbers. Only locations with both a price and an emission estimate are
 * included; the others cannot be priced by a feebate.
 *
 *   npx ts-node-transpile-only --compiler-options '{"module":"commonjs"}' script/green-fee-locations.ts
 *
 * The provider address is a demo address derived from the key; nobody holds
 * its key, so play money paid to it stays there.
 */
import {
  keccak256,
  toUtf8Bytes,
  getAddress,
  hexDataSlice
} from 'ethers/lib/utils'
import {
  computeFootprintForKey,
  listKnownLocations
} from '../../../src/@utils/computeFootprint'

const rows = listKnownLocations()
  .map(({ key }) => {
    const f = computeFootprintForKey(key, 3600)
    if (f.usdCost == null || f.gCO2e == null) return undefined
    return {
      key,
      provider: getAddress(
        hexDataSlice(keccak256(toUtf8Bytes(`cliox-demo-provider:${key}`)), 12)
      ),
      microPerHour: Math.round(f.usdCost * 1e6),
      mgPerHour: Math.round(f.gCO2e * 1000)
    }
  })
  .filter(Boolean)

process.stdout.write(JSON.stringify({ locations: rows }, null, 2) + '\n')
