export const BRIDGE_CONFIG = {
  evm: {
    chainIdHex: '0x7a69',
    chainId: 12,
    // bridgeAddress: '0x14F62f5E2Bb563Ef995964dF2053373f559E3310', // 线上
    bridgeAddress: '0x0B306BF915C4d645ff596e518fAf3F9669b97016', // 本地
    destinationChainId: 3,
  },
  starcoin: {
    // packageAddress: '0x4c57cfe0f117d62db8dfd72f7444b645', // 线上
    packageAddress: '0x9601de11320713ac003a6e41ab8b7dae', // 本地
  },
  tokens: {
    AnvilUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
    SepoliaUSDT: { tokenId: 4, claimFunction: 'claim_bridge_usdt' },
  },
}

export const BRIDGE_ABI = [
  'function bridgeERC20(uint8 tokenID, uint256 amount, bytes recipientAddress, uint8 destinationChainID)',
  'event TokensDeposited(uint8 sourceChainID, uint64 nonce, uint8 destinationChainID, uint8 tokenID, uint64 starcoinAdjustedAmount, address senderAddress, bytes recipientAddress)',
]

export const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount)',
  'function decimals() view returns (uint8)',
]

export function normalizeHex(input: string, expectedBytes?: number): string {
  const trimmed = input.trim()
  const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: ${input}`)
  }
  if (expectedBytes && hex.length !== expectedBytes * 2) {
    throw new Error(`Invalid hex length: expected ${expectedBytes} bytes, got ${hex.length / 2}`)
  }
  return `0x${hex}`
}

export function normalizeHash(input: string): string {
  return input.replace(/^0x/, '').toLowerCase()
}
