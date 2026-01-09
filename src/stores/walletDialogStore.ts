import { create } from 'zustand'

interface WalletDialogState {
  title: string
  isOpen: boolean
  resolver: ((value: string | null) => void) | null
  openDialog: (options: Partial<WalletDialogState>) => Promise<string | null>
  closeDialog: (value: string | null) => void
}

const defaults = {
  title: 'Connect a wallet',
  isOpen: false,
  resolver: null,
}
export const useWalletDialogStore = create<WalletDialogState>((set, get) => ({
  ...defaults,

  openDialog: (options: Partial<WalletDialogState>) => {
    return new Promise<string | null>(resolve => {
      set({ ...options, isOpen: true, resolver: resolve })
    })
  },

  closeDialog: value => {
    const { resolver } = get()
    if (resolver) {
      resolver(value)
    }
    set({ isOpen: false, resolver: null })
  },
}))
