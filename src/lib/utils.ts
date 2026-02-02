import { hexToBytes } from '@/lib/starcoinBcs'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function asyncMap<T, R = unknown>(array: T[], callback: (item: T, index: number, array: T[]) => Promise<R>): Promise<R[]> {
  return Promise.all(array.map(callback))
}

export function base64ToHex(input: string): string {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(`${normalized}${padding}`)
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

export function base64ToBytes(input: string): Uint8Array {
  return hexToBytes(base64ToHex(input))
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export function serializeU64BE(value: number | bigint): Uint8Array {
  let v = BigInt(value)
  const out = new Uint8Array(8)
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

export function normalizeHexLen(input: string, expectedBytes: number): string {
  const trimmed = input.trim()
  let hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: ${input}`)
  }
  if (hex.length > expectedBytes * 2) {
    throw new Error(`Invalid hex length: expected <= ${expectedBytes} bytes, got ${hex.length / 2}`)
  }
  if (hex.length < expectedBytes * 2) {
    hex = hex.padStart(expectedBytes * 2, '0')
  }
  return `0x${hex}`
}
