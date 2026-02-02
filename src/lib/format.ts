export function normalizeEip1193Error(err: unknown): Error {
  const error = err as { code?: number | string; message?: string }
  const code = error?.code
  const msg = error?.message || String(err)
  // 4001: user rejected
  // -32002: request already pending
  const suffix = code != null ? ` (code: ${code})` : ''
  return new Error(msg + suffix)
}

export function normalizeHash(input: string): string {
  if (!input) return ''
  return input.startsWith('0x') ? input.toLowerCase() : `0x${input.toLowerCase()}`
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
  return `${formattedIntegerPart}.${truncatedFractionalPart || '0'}`
}

export function formatDecimal(num: number | string | bigint, maxFractionDigits: number = 6): string {
  if (num === '' || num === null || num === undefined) return ''
  const str = typeof num === 'bigint' ? num.toString() : String(num)
  if (str === '') return ''

  const parsed = parseFloat(str)
  if (isNaN(parsed)) return ''

  const [intPart, decPart = ''] = str.split('.')

  const truncatedDec = decPart.slice(0, maxFractionDigits)

  if (truncatedDec) {
    const trimmed = truncatedDec.replace(/0+$/, '')
    return trimmed ? `${intPart}.${trimmed}` : intPart
  }
  return intPart
}
