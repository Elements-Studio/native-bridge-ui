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
  // 是否是当前链上的默认币种
  isDefault?: boolean
  // 币种 ICON 图标
  icon: string
  // 币种名字
  name: CoinsName

  // 链类型
  walletType: WalletType
  network: {
    name: 'mainnet' | 'sepolia' | 'anvil' | 'devnet' | 'halley'
    chainId: string // '0x1' | '0xfb' | '0x6a'
  }
  gas: 'ETH' | 'SepoliaETH' | 'STC' | 'AnvilETH' | 'Gwei' | 'nanoSTC'
  ca?: string | null
  decimals: number
}
export type Coins = Partial<Record<CoinsName, CoinItem>>
