import ethIcon from '@/assets/img/eth.svg'
import sepoliaEthIcon from '@/assets/img/sepolia_eth.svg'
import sepoliaUsdtIcon from '@/assets/img/sepolia_usdt.svg'
import usdtIcon from '@/assets/img/usdt.svg'
import wbtcIcon from '@/assets/img/wbtc.svg'
import type { WalletInfo, WalletType } from '@/types/domain'
import { freeze } from 'immer'
import { create } from 'zustand'

type CoinsName = 'ETH' | 'USDT' | 'WBTC' | 'SepoliaETH' | 'SepoliaUSDT'
export type CoinItem = {
  icon: string
  name: CoinsName
  walletType: WalletType
  network: {
    name: 'mainnet' | 'sepolia'
    chainId: string // '0x1' | '0xfb' | '0x6a'
  }
  ca?: string | null
}
const mappings: Record<CoinsName, CoinItem> = {
  ETH: {
    icon: ethIcon,
    name: 'ETH',
    walletType: 'EVM',
    network: { name: 'mainnet', chainId: '0x1' },
    ca: null,
  },
  SepoliaETH: {
    icon: sepoliaEthIcon,
    name: 'SepoliaETH',
    walletType: 'EVM',
    network: { name: 'sepolia', chainId: '0xaa36a7' },
    ca: null,
  },
  SepoliaUSDT: {
    icon: sepoliaUsdtIcon,
    name: 'SepoliaUSDT',
    walletType: 'EVM',
    network: { name: 'sepolia', chainId: '0xaa36a7' },
    ca: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  },
  USDT: {
    icon: usdtIcon,
    name: 'USDT',
    walletType: 'EVM',
    network: { name: 'mainnet', chainId: '0x1' },
    ca: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  },

  WBTC: {
    icon: wbtcIcon,
    name: 'WBTC',
    walletType: 'STARCOIN',
    network: { name: 'mainnet', chainId: '0x1' },
    ca: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  },
}

interface GlobalState {
  mappings: typeof mappings

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
    currentCoin: process.env.NODE_ENV === 'development' ? mappings.SepoliaETH : mappings.ETH,
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
