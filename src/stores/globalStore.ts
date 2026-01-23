import ethIcon from '@/assets/img/eth.svg'
import sepoliaEthIcon from '@/assets/img/sepolia_eth.svg'
import sepoliaUsdtIcon from '@/assets/img/sepolia_usdt.svg'
import usdtIcon from '@/assets/img/usdt.svg'
import type { WalletInfo, WalletType } from '@/types/domain'
import { freeze } from 'immer'
import { create } from 'zustand'

type CoinsName = 'ETH' | 'USDT' | 'WBTC' | 'SepoliaETH' | 'SepoliaUSDT' | 'StarUSDT' | 'AnvilUSDT' | 'AnvilETH' | 'STC'
export type CoinItem = {
  icon: string
  name: CoinsName
  walletType: WalletType
  network: {
    name: 'mainnet' | 'sepolia' | 'anvil' | 'devnet'
    chainId: string // '0x1' | '0xfb' | '0x6a'
  }
  gas: 'ETH' | 'SepoliaETH' | 'STC' | 'AnvilETH'
  ca?: string | null
}
const mappings: Record<CoinsName, CoinItem> = {
  ETH: {
    icon: ethIcon,
    name: 'ETH',
    walletType: 'EVM',
    network: { name: 'mainnet', chainId: '0x1' },
    gas: 'ETH',
    ca: null,
  },
  SepoliaETH: {
    icon: sepoliaEthIcon,
    name: 'SepoliaETH',
    walletType: 'EVM',
    network: { name: 'sepolia', chainId: '0xaa36a7' },
    gas: 'SepoliaETH',
    ca: null,
  },
  SepoliaUSDT: {
    icon: sepoliaUsdtIcon,
    name: 'SepoliaUSDT',
    walletType: 'EVM',
    network: { name: 'sepolia', chainId: '0xaa36a7' },
    gas: 'SepoliaETH',
    ca: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  },
  AnvilETH: {
    icon: ethIcon,
    name: 'AnvilETH',
    walletType: 'EVM',
    network: { name: 'anvil', chainId: '0x7a69' },
    gas: 'AnvilETH',
    ca: null,
  },
  AnvilUSDT: {
    icon: usdtIcon,
    name: 'AnvilUSDT',
    walletType: 'EVM',
    network: { name: 'anvil', chainId: '0x7a69' },
    gas: 'AnvilETH',
    ca: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  },
  USDT: {
    icon: usdtIcon,
    name: 'USDT',
    walletType: 'EVM',
    network: { name: 'mainnet', chainId: '0x1' },
    gas: 'ETH',
    ca: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  },

  STC: {
    icon: usdtIcon,
    name: 'STC',
    walletType: 'STARCOIN',
    network: { name: 'devnet', chainId: '0x1' },
    gas: 'STC',
  },

  StarUSDT: {
    icon: usdtIcon,
    name: 'StarUSDT',
    walletType: 'STARCOIN',
    network: { name: 'devnet', chainId: '0x1' },
    gas: 'STC',
    ca: '0x9601de11320713ac003a6e41ab8b7dae::USDT::USDT',
    // ca: '0x9601de11320713ac003a6e41ab8b7dae:Bridge::USDT::USDT'
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
    currentCoin: process.env.NODE_ENV === 'development' ? mappings.AnvilUSDT : mappings.ETH,
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
