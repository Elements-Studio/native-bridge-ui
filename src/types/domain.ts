export type EIP1193Provider = {
  request: (args: { method: string; params?: any[] | object }) => Promise<any>
  on?: (event: string, handler: (...args: any[]) => void) => void
  removeListener?: (event: string, handler: (...args: any[]) => void) => void
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
