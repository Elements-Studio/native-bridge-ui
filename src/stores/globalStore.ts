import type { WalletInfo } from '@/types/domain'
import { freeze } from 'immer'
import { create } from 'zustand'

interface GlobalState {
  evmWalletInfo: WalletInfo | null
  starcoinWalletInfo: WalletInfo | null
  setEvmWalletInfo: (walletInfo: WalletInfo | null) => void
  setStarcoinWalletInfo: (walletInfo: WalletInfo | null) => void
}

const defaults = freeze({
  evmWalletInfo: null,
  starcoinWalletInfo: null,
})
export const useGlobalStore = create<GlobalState>((set, get) => ({
  ...defaults,

  setEvmWalletInfo: (walletInfo: WalletInfo | null) => {
    set({ evmWalletInfo: walletInfo })
  },
  setStarcoinWalletInfo: (walletInfo: WalletInfo | null) => {
    set({ starcoinWalletInfo: walletInfo })
  },
}))
