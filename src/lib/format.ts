export function normalizeEip1193Error(err: unknown): Error {
  const error = err as { code?: number | string; message?: string }
  const code = error?.code
  const msg = error?.message || String(err)
  // 4001: user rejected
  // -32002: request already pending
  const suffix = code != null ? ` (code: ${code})` : ''
  return new Error(msg + suffix)
}

export function formatAddress(address: string, length = 6): string {
  if (address.length <= length * 2) {
    return address
  }
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

export function toFixedWithoutRounding(num: number | string, decimalPlaces: number): string {
  if (!num) return '0.0'
  const [integerPart, fractionalPart = ''] = String(num).split('.')
  const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (decimalPlaces === 0) {
    return formattedIntegerPart
  }
  const truncatedFractionalPart = fractionalPart.slice(0, decimalPlaces)
  return `${formattedIntegerPart}.${truncatedFractionalPart}`
}
