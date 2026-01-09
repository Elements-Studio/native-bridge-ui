import { freeze } from 'immer'
import { create } from 'zustand'

interface GlobalState {
  fromAddress: string | null
  toAddress: string | null

  setFromAddress: (address: string | null) => void
  setToAddress: (address: string | null) => void
}

const defaults = freeze({
  fromAddress: null,
  toAddress: null,
})
export const useWalletDialogStore = create<GlobalState>((set, get) => ({
  ...defaults,

  setFromAddress: (address: string | null) => {
    set({ fromAddress: address })
  },
  setToAddress: (address: string | null) => {
    set({ toAddress: address })
  },
}))
