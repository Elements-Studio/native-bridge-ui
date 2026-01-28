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
}
