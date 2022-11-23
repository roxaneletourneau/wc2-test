/**
 * @desc Reference list of Tezos chains
 */

/**
 * Types
 */
export type TTezosChain = keyof typeof TEZOS_TEST_CHAINS

/**
 * Chains
 */
export const TEZOS_MAINNET_CHAINS = {
  // TODO
}

interface TezosTestChains {
  [key: string]: ChainMetadata
}

type ChainMetadata = {
  chainId: string
  name: string
  logo: string
  rgb: string
  rpc: string
}

export const TEZOS_TEST_CHAINS: TezosTestChains = {
  'tezos:ghostnet': {
    chainId: 'ghostnet',
    name: 'Tezos Testnet',
    logo: '/chain-logos/tezos-xtz-logo.png',
    rgb: '99, 125, 234',
    rpc: 'https://ghostnet.ecadinfra.com/'
  },
  'tezos:limanet': {
    chainId: 'limanet',
    name: "Tezos Limanet",
    logo: '/chain-logos/tezos-xtz-logo.png',
    rgb: '99, 125, 234',
    rpc: "https://limanet.ecadinfra.com/",
  },
}

export const TEZOS_CHAINS = { ...TEZOS_MAINNET_CHAINS, ...TEZOS_TEST_CHAINS }

/**
 * Methods
 */
export const TEZOS_SIGNING_METHODS = {
  TEZOS_SIGN_MESSAGE: 'tezos_signExpression'
}
