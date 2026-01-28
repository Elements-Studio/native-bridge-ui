import devEnv from './env.development'
import prodEnv from './env.production'
import type { Coins } from './types/domain'

const env = (process.env.NODE_ENV === 'development' ? devEnv : prodEnv) as {
  apis: {
    '/transfers': string
    '/estimate_fees': string
    committees: {
      signs: string[]
    }
  }
  coins: Coins
  bridge: {
    evm: {
      chainIdHex: string
      chainId: number
      bridgeAddress: string
      destinationChainId: number
    }
    starcoin: {
      packageAddress: string
      chainId: number
    }
    tokens: {
      AnvilUSDT: { tokenId: number; claimFunction: 'claim_bridge_usdt' }
      SepoliaUSDT: { tokenId: number; claimFunction: 'claim_bridge_usdt' }
      StarUSDT: { tokenId: number; claimFunction: 'claim_bridge_usdt'; sendFunction: 'send_bridge_usdt'; decimals: number }
    }
  }
}

export default env
