import TezosLib from '@/lib/TezosLib'

export let wallet1: TezosLib
export let wallet2: TezosLib
export let wallet3: TezosLib
export let tezosWallets: Record<string, TezosLib>
export let tezosAddresses: string[]

let address1: string
let address2: string
let address3: string
/**
 * Utilities
 */
export async function createOrRestoreTezosWallet() {
  const secretKey1 = localStorage.getItem('TEZOS_SECRET_KEY_1')
  const secretKey2 = localStorage.getItem('TEZOS_SECRET_KEY_2')
  const secretKey3 = localStorage.getItem('TEZOS_SECRET_KEY_3')

  if (secretKey1  && secretKey2 && secretKey3) {
    wallet1 = new TezosLib(secretKey1)
    wallet2 = new TezosLib(secretKey2)
    wallet3 = new TezosLib(secretKey3)
  } else {
    wallet1 = new TezosLib('spsk27fTR9Yz1415NAfRZMGjMjvbwcHVpXxufRz26uxLX6deU3Tn9T')
    wallet2 = new TezosLib('spsk39RgVP3ksU8jed7uXi4Ze82eqEZyK7o261rW2rdVD3hwyRWtRE')
    wallet3 = new TezosLib('spsk1m2X15Bzhcfi8Hf7sGDAQcAzy3T7EcshVVt4T2sjVn373mYAmV')
    // Don't store secretKey in local storage in a production project!
    localStorage.setItem(
      'TEZOS_SECRET_KEY_1', wallet1.secret
    )
    localStorage.setItem(
      'TEZOS_SECRET_KEY_2', wallet2.secret
    )
    localStorage.setItem(
      'TEZOS_SECRET_KEY_3', wallet3.secret
    )
  }

  address1 = await wallet1.getAddress();
  console.log('tezos pkh', address1)
  address2 = await wallet2.getAddress();
  console.log('tezos pkh', address2)
  address3 = await wallet3.getAddress();
  console.log('tezos pkh', address3)

  tezosWallets = {
    [address1]: wallet1,
    [address2]: wallet2,
    [address3]: wallet3,
  }
  tezosAddresses = Object.keys(tezosWallets)

  return {
    tezosWallets,
    tezosAddresses
  }
}
