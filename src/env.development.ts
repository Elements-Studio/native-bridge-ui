import ethIcon from '@/assets/img/eth.svg'
import sepoliaEthIcon from '@/assets/img/sepolia_eth.svg'
import sepoliaUsdtIcon from '@/assets/img/sepolia_usdt.svg'
import ststarcoinIcon from '@/assets/img/starcoin.svg'
import usdtIcon from '@/assets/img/usdt.svg'
import wbtcIcon from '@/assets/img/wbtc.svg'
import type { Coins } from '@/types/domain'

export default {
  apis: {
    '/transfers': `https://bridge-indexer-monitor-dev2anvil.starswap.xyz/transfers`,
    '/estimate_fees': `https://bridge-node1-dev2anvil.starswap.xyz/estimate_fees`,
    committees: {
      signs: [
        `https://bridge-node1-dev2anvil.starswap.xyz/sign`,
        `https://bridge-node2-dev2anvil.starswap.xyz/sign`,
        `https://bridge-node3-dev2anvil.starswap.xyz/sign`,
      ],
    },
  },

  coins: {
    ETH: {
      icon: ethIcon,
      name: 'ETH',
      walletType: 'EVM',
      network: { name: 'mainnet', chainId: '0x1' },
      gas: 'Gwei',
      ca: null,
      decimals: 18,
    },
    USDT: {
      icon: usdtIcon,
      name: 'USDT',
      walletType: 'EVM',
      network: { name: 'mainnet', chainId: '0x1' },
      gas: 'Gwei',
      ca: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    SepoliaETH: {
      icon: sepoliaEthIcon,
      name: 'SepoliaETH',
      walletType: 'EVM',
      network: { name: 'sepolia', chainId: '0xaa36a7' },
      gas: 'Gwei',
      ca: null,
      decimals: 18,
    },
    SepoliaUSDT: {
      icon: sepoliaUsdtIcon,
      name: 'SepoliaUSDT',
      walletType: 'EVM',
      network: { name: 'sepolia', chainId: '0xaa36a7' },
      gas: 'Gwei',
      ca: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
      decimals: 6,
    },
    AnvilETH: {
      icon: ethIcon,
      name: 'AnvilETH',
      walletType: 'EVM',
      network: { name: 'anvil', chainId: '0x7a69' },
      gas: 'Gwei',
      ca: null,
      decimals: 18,
    },
    AnvilUSDT: {
      isDefault: true,
      icon: usdtIcon,
      name: 'AnvilUSDT',
      walletType: 'EVM',
      network: { name: 'anvil', chainId: '0x7a69' },
      gas: 'Gwei',
      ca: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      decimals: 6,
    },
    WBTC: {
      icon: wbtcIcon,
      name: 'WBTC',
      walletType: 'EVM',
      network: { name: 'mainnet', chainId: '0x1' },
      gas: 'Gwei',
      ca: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
    },
    // STC: {
    //   icon: usdtIcon,
    //   name: 'STC',
    //   walletType: 'STARCOIN',
    //   network: { name: 'devnet', chainId: '0x1' },
    //   gas: 'nanoSTC',
    // },
    StarUSDT: {
      isDefault: true,
      icon: usdtIcon,
      name: 'StarUSDT',
      walletType: 'STARCOIN',
      network: { name: 'devnet', chainId: '0x1' },
      gas: 'nanoSTC',
      ca: '0x7db7d4c5322285b8357b81aaaa1aba09::USDT::USDT',
      decimals: 6,
    },
  } satisfies Coins,

  bridge: {
    evm: {
      chainIdHex: '0x7a69',
      chainId: 12,
      bridgeAddress: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
      destinationChainId: 2,
    },
    starcoin: {
      packageAddress: '0x7db7d4c5322285b8357b81aaaa1aba09',
      chainId: 2,
    },
    tokens: {
      AnvilUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
      SepoliaUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
      StarUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt', sendFunction: 'send_bridge_usdt', decimals: 6 },
    },
  },

  icons: {
    ETH: ethIcon,
    STARCOIN: ststarcoinIcon,
  },
}
