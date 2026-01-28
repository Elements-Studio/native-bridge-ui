import ethIcon from '@/assets/img/eth.svg'
import sepoliaEthIcon from '@/assets/img/sepolia_eth.svg'
import sepoliaUsdtIcon from '@/assets/img/sepolia_usdt.svg'
import usdtIcon from '@/assets/img/usdt.svg'
import wbtcIcon from '@/assets/img/wbtc.svg'

const indexerHost = '/api'
const signHost = 'https://bridge-sign-monitor-dev2anvil.starswap.xyz'

export default {
  apis: {
    '/transfers': `${indexerHost}/transfers`,
    '/estimate_fees': `${indexerHost}/estimate_fees`,
    committees: {
      signs: [
        `${signHost}/bridge-node1-dev2anvil/sign`,
        `${signHost}/bridge-node2-dev2anvil/sign`,
        `${signHost}/bridge-node3-dev2anvil/sign`,
      ],
    },
  },

  coins: {
    ETH:
      process.env.NODE_ENV === 'development'
        ? {
            icon: ethIcon,
            name: 'ETH',
            walletType: 'EVM',
            network: { name: 'mainnet', chainId: '0x1' },
            gas: 'ETH',
            ca: null,
          }
        : undefined,
    USDT: {
      icon: usdtIcon,
      name: 'USDT',
      walletType: 'EVM',
      network: { name: 'mainnet', chainId: '0x1' },
      gas: 'ETH',
      ca: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
    SepoliaETH:
      process.env.NODE_ENV === 'development'
        ? {
            icon: sepoliaEthIcon,
            name: 'SepoliaETH',
            walletType: 'EVM',
            network: { name: 'sepolia', chainId: '0xaa36a7' },
            gas: 'SepoliaETH',
            ca: null,
          }
        : undefined,
    SepoliaUSDT:
      process.env.NODE_ENV === 'development'
        ? {
            icon: sepoliaUsdtIcon,
            name: 'SepoliaUSDT',
            walletType: 'EVM',
            network: { name: 'sepolia', chainId: '0xaa36a7' },
            gas: 'SepoliaETH',
            ca: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
          }
        : undefined,
    AnvilETH:
      process.env.NODE_ENV === 'development'
        ? {
            icon: ethIcon,
            name: 'AnvilETH',
            walletType: 'EVM',
            network: { name: 'anvil', chainId: '0x7a69' },
            gas: 'AnvilETH',
            ca: null,
          }
        : undefined,
    AnvilUSDT:
      process.env.NODE_ENV === 'development'
        ? {
            icon: usdtIcon,
            name: 'AnvilUSDT',
            walletType: 'EVM',
            network: { name: 'anvil', chainId: '0x7a69' },
            gas: 'AnvilETH',
            ca: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
          }
        : undefined,

    WBTC:
      process.env.NODE_ENV === 'development'
        ? {
            icon: wbtcIcon,
            name: 'WBTC',
            walletType: 'EVM',
            network: { name: 'mainnet', chainId: '0x1' },
            gas: 'ETH',
            ca: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
          }
        : undefined,

    STC:
      process.env.NODE_ENV === 'development'
        ? {
            icon: usdtIcon,
            name: 'STC',
            walletType: 'STARCOIN',
            network: { name: 'devnet', chainId: '0x1' },
            gas: 'STC',
          }
        : undefined,

    StarUSDT: {
      icon: usdtIcon,
      name: 'StarUSDT',
      walletType: 'STARCOIN',
      network: { name: 'devnet', chainId: '0x1' },
      gas: 'STC',
      ca: '0x9601de11320713ac003a6e41ab8b7dae::USDT::USDT',
      // ca: '0x9601de11320713ac003a6e41ab8b7dae:Bridge::USDT::USDT'
    },
  },

  bridge: {
    evm: {
      chainIdHex: '0x7a69',
      // chainIdHex: '0xc', // 本地测试
      chainId: 12,
      // bridgeAddress: '0x14F62f5E2Bb563Ef995964dF2053373f559E3310', // 线上
      bridgeAddress: '0x0B306BF915C4d645ff596e518fAf3F9669b97016', // 本地
      // destinationChainId: 3, // 线上
      destinationChainId: 2, // 本地测试
    },
    starcoin: {
      // packageAddress: '0x4c57cfe0f117d62db8dfd72f7444b645', // 线上
      packageAddress: '0x9601de11320713ac003a6e41ab8b7dae', // 本地
      chainId: 2,
    },
    tokens: {
      AnvilUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
      SepoliaUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
      StarUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt', sendFunction: 'send_bridge_usdt', decimals: 6 },
    },
  },
}
