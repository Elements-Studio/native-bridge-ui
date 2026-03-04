import ethIcon from '@/assets/img/eth.svg'
import ststarcoinIcon from '@/assets/img/starcoin.svg'
import usdtIcon from '@/assets/img/usdt.svg'
import type { Coins } from '@/types/domain'

export default {
  apis: {
    '/transfers': `https://bridge-indexer-monitor.starswap.xyz/transfers`,
    '/estimate_fees': `https://bridge-indexer-monitor.starswap.xyz/estimate_fees`,
    committees: {
      signs: [`https://bridge-node0.starswap.xyz/sign`, `https://bridge-node1.starswap.xyz/sign`, `https://bridge-node2.starswap.xyz/sign`],
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
      decimals: 6,
    },
    StarUSDT: {
      isDefault: true,
      icon: usdtIcon,
      name: 'StarUSDT',
      walletType: 'STARCOIN',
      network: { name: 'main', chainId: '0x1' },
      gas: 'nanoSTC',
      ca: '0xbd8f731c6927532852241853102ca259::USDT::USDT',
      decimals: 6,
    },
  } satisfies Coins,

  bridge: {
    evm: {
      chainIdHex: '0x1',
      chainId: 10,
      bridgeAddress: '0x088Afa555ed74FD44DA5A370a814C0a582981066',
      destinationChainId: 0,
    },
    starcoin: {
      packageAddress: '0xbd8f731c6927532852241853102ca259',
      chainId: 0,
    },
    tokens: {
      USDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
      StarUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt', sendFunction: 'send_bridge_usdt', decimals: 6 },
    },
  },

  icons: {
    ETH: ethIcon,
    STARCOIN: ststarcoinIcon,
  },
}
