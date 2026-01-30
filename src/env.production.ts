import usdtIcon from '@/assets/img/usdt.svg'
import type { Coins } from './types/domain'

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
    USDT: {
      isDefault: true,
      icon: usdtIcon,
      name: 'USDT',
      walletType: 'EVM',
      network: { name: 'mainnet', chainId: '0x1' },
      gas: 'Gwei',
      ca: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },

    StarUSDT: {
      isDefault: true,
      icon: usdtIcon,
      name: 'StarUSDT',
      walletType: 'STARCOIN',
      network: { name: 'devnet', chainId: '0x1' },
      gas: 'nanoSTC',
      ca: '0x7db7d4c5322285b8357b81aaaa1aba09::USDT::USDT',
    },

    AnvilUSDT: {
      icon: usdtIcon,
      name: 'AnvilUSDT',
      walletType: 'EVM',
      network: { name: 'anvil', chainId: '0x7a69' },
      gas: 'Gwei',
      ca: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    },
  } as Coins,

  bridge: {
    evm: {
      chainIdHex: '0x7a69',
      chainId: 12,
      bridgeAddress: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
      destinationChainId: 2,
    },
    starcoin: {
      // packageAddress: '0x4c57cfe0f117d62db8dfd72f7444b645', // 线上
      packageAddress: '0x7db7d4c5322285b8357b81aaaa1aba09', // 本地
      chainId: 2,
    },
    tokens: {
      AnvilUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
      SepoliaUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
      StarUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt', sendFunction: 'send_bridge_usdt', decimals: 6 },
    },
  },
}
