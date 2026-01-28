import usdtIcon from '@/assets/img/usdt.svg'

const indexerHost = 'https://bridge-indexer-monitor-dev2anvil.starswap.xyz'
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
    USDT: {
      icon: usdtIcon,
      name: 'USDT',
      walletType: 'EVM',
      network: { name: 'mainnet', chainId: '0x1' },
      gas: 'ETH',
      ca: '0xdac17f958d2ee523a2206206994597c13d831ec7',
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
  },

  bridge: {
    evm: {
      chainIdHex: '0x7a69',
      // chainIdHex: '0xc', // 本地测试
      chainId: 12,
      bridgeAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
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
