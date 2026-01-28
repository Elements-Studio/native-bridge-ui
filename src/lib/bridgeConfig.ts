import env from '@/env'
export const BRIDGE_CONFIG = env.bridge

export const BRIDGE_ABI = [
  'function bridgeERC20(uint8 tokenID, uint256 amount, bytes recipientAddress, uint8 destinationChainID)',
  'function transferBridgedTokensWithSignatures(bytes[] signatures, tuple(uint8 messageType, uint8 version, uint64 nonce, uint8 chainID, bytes payload) message)',
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
