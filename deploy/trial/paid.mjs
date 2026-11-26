// Try a paid (fixed-price) record on the Clio-X Sepolia trial, end to end:
// publish with a price, fund a separate buyer, buy, download, and print the
// token balances before and after so the movement can be checked on chain.
//
// Why not ocean-cli: its publish helper (ocean.js createAsset) sets the
// exchange's allowedConsumer to the publisher, so only the publisher could buy.
// This script creates the price the way the portal does (no buyer restriction,
// datatoken template 2, buyFromFreAndOrder).
//
// Price token: Sepolia WETH, because Sepolia OCEAN can only be minted by its
// owner and none of the trial wallets hold any. The router accepts WETH; it is
// just not on its approved list, so the community fee is 0.2% instead of 0.1%.
//
// Usage (keys come from 1Password via paid.zsh):
//   node paid.mjs publish            -> prints DID
//   node paid.mjs buy <did>          -> wraps ETH, buys, downloads, prints balances
import {
  Aquarius,
  Datatoken,
  FixedRateExchange,
  Nft,
  NftFactory,
  ProviderInstance,
  generateDid,
  getEventFromTx,
  ZERO_ADDRESS
} from '@oceanprotocol/lib'
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatEther,
  parseEther,
  toBeHex
} from 'ethers'

const { SELLER_KEY, BUYER_KEY, RPC, NODE_URL } = process.env
const CHAIN_ID = 11155111
const FACTORY = '0xEF62FB495266C72a5212A11Dce8baa79Ec0ABeB1'
const FRE = '0x80E63f73cAc60c1662f27D2DFd2EA834acddBaa8'
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
const PRICE = '0.001' // WETH per access
const FILE_URL =
  'https://raw.githubusercontent.com/nakamura196/ClioX-mvg-portal/f0875515268d8eb6ad40d6a3d99056f97408ff65/deploy/trial/sample/declaration-of-independence.txt'

const provider = new JsonRpcProvider(RPC)
const seller = new Wallet(SELLER_KEY, provider)
const buyer = BUYER_KEY ? new Wallet(BUYER_KEY, provider) : null
const weth = (signer) =>
  new Contract(
    WETH,
    [
      'function deposit() payable',
      'function balanceOf(address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)'
    ],
    signer
  )

async function publish() {
  const owner = await seller.getAddress()
  const factory = new NftFactory(FACTORY, seller, CHAIN_ID)
  const tx = await factory.createNftWithDatatokenWithFixedRate(
    {
      name: 'Clio-X trial (paid)',
      symbol: 'CLIOX-PAID',
      templateIndex: 1,
      tokenURI: 'https://cliox.ldas.jp/images/cliox.svg',
      transferable: true,
      owner
    },
    {
      templateIndex: 2,
      minter: owner,
      paymentCollector: owner,
      mpFeeAddress: owner,
      feeToken: WETH,
      feeAmount: '0',
      cap: '115792089237316195423570985008687907853269984665640564039457',
      name: 'Clio-X paid access',
      symbol: 'CXPAID'
    },
    {
      fixedRateAddress: FRE,
      baseTokenAddress: WETH,
      owner,
      marketFeeCollector: owner,
      baseTokenDecimals: 18,
      datatokenDecimals: 18,
      fixedRate: PRICE,
      marketFee: '0',
      withMint: true,
      allowedConsumer: ZERO_ADDRESS
    }
  )
  const receipt = await tx.wait()
  const nftAddress = getEventFromTx(receipt, 'NFTCreated').args.newTokenAddress
  const datatokenAddress = getEventFromTx(receipt, 'TokenCreated').args
    .newTokenAddress
  console.log(`create tx ${receipt.hash}`)
  console.log(`nft ${nftAddress}  datatoken ${datatokenAddress}`)

  const files = await ProviderInstance.encrypt(
    {
      datatokenAddress,
      nftAddress,
      files: [{ type: 'url', url: FILE_URL, method: 'GET' }]
    },
    CHAIN_ID,
    NODE_URL,
    seller
  )
  const did = generateDid(nftAddress, CHAIN_ID)
  const now = new Date().toISOString()
  const ddo = {
    '@context': ['https://w3id.org/did/v1'],
    id: did,
    nftAddress,
    version: '4.1.0',
    chainId: CHAIN_ID,
    metadata: {
      created: now,
      updated: now,
      type: 'dataset',
      name: 'Declaration of Independence (1776) - paid sample record',
      description: `Test of a paid record on the Clio-X trial network. Same public-domain text as the free sample; access costs ${PRICE} WETH (Sepolia test ETH, no real value) so the payment can be traced on chain.`,
      tags: ['clio-x-trial', 'public-domain', 'sample', 'paid-test'],
      author: 'Clio-X trial (UBC / University of Tokyo)',
      license: 'Public Domain',
      additionalInformation: { termsAndConditions: true }
    },
    services: [
      {
        id: 'access',
        type: 'access',
        files,
        datatokenAddress,
        serviceEndpoint: NODE_URL,
        timeout: 86400
      }
    ]
  }
  const aquarius = new Aquarius(NODE_URL)
  const { hash } = await aquarius.validate(ddo, seller, NODE_URL)
  const encrypted = await ProviderInstance.encrypt(
    ddo,
    CHAIN_ID,
    NODE_URL,
    seller
  )
  const setTx = await new Nft(seller, CHAIN_ID).setMetadata(
    nftAddress,
    owner,
    0,
    NODE_URL,
    '',
    toBeHex(2),
    encrypted,
    hash
  )
  const setReceipt = await setTx.wait()
  console.log(`setMetadata tx ${setReceipt.hash}`)
  console.log(`DID ${did}`)
}

async function balances(label, dt, exchangeId) {
  const w = weth(provider)
  const dtc = new Contract(
    dt,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  )
  const fre = new FixedRateExchange(FRE, seller, CHAIN_ID)
  const ex = await fre.getExchange(exchangeId)
  const row = async (name, a) =>
    `  ${name.padEnd(8)} ${a}  WETH ${formatEther(
      await w.balanceOf(a)
    )}  DT ${formatEther(await dtc.balanceOf(a))}  ETH ${formatEther(
      await provider.getBalance(a)
    )}`
  console.log(`[${label}] exchange btBalance ${ex.btBalance} WETH`)
  console.log(await row('buyer', await buyer.getAddress()))
  console.log(await row('seller', await seller.getAddress()))
  console.log(await row('exchange', FRE))
}

async function buy(did) {
  const me = await buyer.getAddress()
  const ddo = await (
    await fetch(`${NODE_URL}/api/aquarius/assets/ddo/${did}`)
  ).json()
  const service = ddo.services[0]
  const dt = service.datatokenAddress
  const exchangeId = await new FixedRateExchange(
    FRE,
    seller,
    CHAIN_ID
  ).generateExchangeId(WETH, dt)

  // Gas for the buyer (a separate wallet, so the payment crosses accounts)
  if ((await provider.getBalance(me)) < parseEther('0.005')) {
    const t = await seller.sendTransaction({
      to: me,
      value: parseEther('0.01')
    })
    await t.wait()
    console.log(`funded buyer 0.01 ETH: ${t.hash}`)
  }
  await balances('before', dt, exchangeId)

  const fre = new FixedRateExchange(FRE, buyer, CHAIN_ID)
  const quote = await fre.calcBaseInGivenDatatokensOut(exchangeId, '1')
  console.log(
    `quote: ${quote.baseTokenAmount} WETH (community fee ${quote.oceanFeeAmount}, market fee ${quote.marketFeeAmount})`
  )
  const need = parseEther(quote.baseTokenAmount)
  if ((await weth(provider).balanceOf(me)) < need) {
    const t = await weth(buyer).deposit({ value: need })
    await t.wait()
    console.log(`wrapped ${quote.baseTokenAmount} ETH -> WETH: ${t.hash}`)
  }
  const ap = await weth(buyer).approve(dt, need)
  await ap.wait()
  console.log(`approve WETH to datatoken: ${ap.hash}`)

  const init = await ProviderInstance.initialize(
    did,
    service.id,
    0,
    me,
    NODE_URL
  )
  const orderTx = await new Datatoken(buyer, CHAIN_ID).buyFromFreAndOrder(
    dt,
    {
      consumer: me,
      serviceIndex: 0,
      _providerFee: init.providerFee,
      _consumeMarketFee: {
        consumeMarketFeeAddress: ZERO_ADDRESS,
        consumeMarketFeeToken: WETH,
        consumeMarketFeeAmount: '0'
      }
    },
    {
      exchangeContract: FRE,
      exchangeId,
      maxBaseTokenAmount: quote.baseTokenAmount,
      baseTokenAddress: WETH,
      baseTokenDecimals: 18,
      swapMarketFee: '0',
      marketFeeAddress: ZERO_ADDRESS
    }
  )
  const orderReceipt = await orderTx.wait()
  console.log(`buyFromFreAndOrder tx ${orderReceipt.hash}`)
  await balances('after', dt, exchangeId)

  const url = await ProviderInstance.getDownloadUrl(
    did,
    service.id,
    0,
    orderReceipt.hash,
    NODE_URL,
    buyer
  )
  const res = await fetch(url)
  const text = await res.text()
  console.log(
    `download: HTTP ${res.status}, ${text.length} chars, starts "${text
      .slice(0, 60)
      .replace(/\s+/g, ' ')}"`
  )
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'publish') await publish()
else if (cmd === 'buy') await buy(arg)
else console.error('usage: node paid.mjs publish | buy <did>')
