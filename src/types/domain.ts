export type EIP1193Provider = {
  request: (args: { method: string; params?: (string | number | object)[] | object }) => Promise<string | number | object>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
  addListener?: (event: string, handler: (...args: unknown[]) => void) => void
  isMetaMask?: boolean
}

export type WalletInfo = {
  address: string
  network: {
    name: string
    chainId: string
  }
  balance: string
}

export type WalletType = 'EVM' | 'STARCOIN'
export type Callbacks = {
  onUnauthenticated?: () => void
}

export type CoinsName = 'ETH' | 'USDT' | 'WBTC' | 'SepoliaETH' | 'SepoliaUSDT' | 'StarUSDT' | 'AnvilUSDT' | 'AnvilETH' | 'STC'
export type CoinItem = {
  isDefault?: boolean
  icon: string
  name: CoinsName
  bridgeTokenName: string
  walletType: WalletType
  network: {
    name: 'mainnet' | 'sepolia' | 'anvil' | 'devnet'
    chainId: string // '0x1' | '0xfb' | '0x6a'
  }
  gas: 'ETH' | 'SepoliaETH' | 'STC' | 'AnvilETH' | 'Gwei' | 'nanoSTC'
  ca?: string | null
}
export type Coins = Record<CoinsName, CoinItem | undefined>
