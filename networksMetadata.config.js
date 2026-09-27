// networks metadata to add to EVM-based Chains list
// see: https://github.com/ethereum-lists/chains

const networksMetadata = [
  {
    // Sepolia is marked isCustom in chains.config.js, which drops it from the
    // chainid.network list, so its metadata has to be supplied here too.
    // Without it, asset cards show the network as "Unknown".
    chainId: 11155111,
    networkId: 11155111,
    name: 'Sepolia',
    title: 'Ethereum Testnet Sepolia',
    chain: 'ETH',
    rpc: ['https://ethereum-sepolia-rpc.publicnode.com'],
    faucets: [],
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    },
    infoURL: 'https://sepolia.otterscan.io',
    shortName: 'sep',
    explorers: [
      {
        name: 'etherscan-sepolia',
        url: 'https://sepolia.etherscan.io',
        standard: 'EIP3091'
      }
    ]
  },
  {
    chainId: 32456,
    networkId: 32456,
    name: 'Pontus-X Devnet',
    chain: 'Pontus-X',
    rpc: ['https://rpc.dev.pontus-x.eu'],
    faucets: [],
    nativeCurrency: {
      name: 'EURAU',
      symbol: 'EURAU',
      decimals: 6
    },
    infoURL: 'https://docs.pontus-x.eu',
    shortName: 'Pontus-X',
    explorers: [
      {
        name: 'Pontus-X Devnet Explorer',
        url: 'https://explorer.pontus-x.eu/devnet/pontusx',
        standard: ''
      }
    ]
  },
  {
    chainId: 32457,
    networkId: 32457,
    name: 'Pontus-X Testnet',
    chain: 'Pontus-X',
    rpc: ['https://rpc.test.pontus-x.eu'],
    faucets: [],
    nativeCurrency: {
      name: 'EURAU',
      symbol: 'EURAU',
      decimals: 6
    },
    infoURL: 'https://docs.pontus-x.eu',
    shortName: 'Pontus-X',
    explorers: [
      {
        name: 'Pontus-X Testnet Explorer',
        url: 'https://explorer.pontus-x.eu/testnet/pontusx',
        standard: ''
      }
    ]
  }
]

module.exports = {
  networksMetadata
}
