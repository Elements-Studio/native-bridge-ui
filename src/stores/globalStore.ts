import env from '@/env'
import type { CoinItem, Coins, WalletInfo, WalletType } from '@/types/domain'
import { freeze } from 'immer'
import { create } from 'zustand'

const mappings = env.coins

interface GlobalState {
  mappings: Coins

  fromWalletType: WalletType
  setFromWalletType: (walletType: WalletType) => void

  toWalletType: WalletType
  setToWalletType: (walletType: WalletType) => void

  currentCoin: CoinItem
  setCurrentCoin: (coin: CoinItem) => void

  evmWalletInfo: WalletInfo | null
  setEvmWalletInfo: (walletInfo: WalletInfo | null) => void

  starcoinWalletInfo: WalletInfo | null
  setStarcoinWalletInfo: (walletInfo: WalletInfo | null) => void

  inputBalance: string
  setInputBalance: (balance: string) => void
}

const defaults = freeze(
  {
    mappings,
    fromWalletType: 'EVM' as WalletType,
    toWalletType: 'STARCOIN' as WalletType,
    currentCoin: Object.values(mappings).find(coin => coin?.walletType === 'EVM' && coin?.isDefault)!,
    evmWalletInfo: null,
    starcoinWalletInfo: null,
    inputBalance: '',
  },
  true,
)

export const useGlobalStore = create<GlobalState>(set => ({
  ...defaults,

  setFromWalletType: (walletType: WalletType) => {
    set({ fromWalletType: walletType })
  },

  setToWalletType: (walletType: WalletType) => {
    set({ toWalletType: walletType })
  },

  setCurrentCoin: (coin: CoinItem) => {
    set({ currentCoin: coin })
  },

  setEvmWalletInfo: (walletInfo: WalletInfo | null) => {
    set({ evmWalletInfo: walletInfo, inputBalance: '' })
  },
  setStarcoinWalletInfo: (walletInfo: WalletInfo | null) => {
    set({ starcoinWalletInfo: walletInfo })
  },
  setInputBalance: (balance: string) => {
    set({ inputBalance: balance })
  },
}))
