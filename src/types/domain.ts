export type EIP1193Provider = {
  request: (args: { method: string; params?: (string | number | object)[] | object }) => Promise<string | number | object>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
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
