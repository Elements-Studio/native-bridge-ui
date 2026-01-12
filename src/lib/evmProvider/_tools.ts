import type { EIP1193Provider } from '@/types/domain'

type AnyProvider = EIP1193Provider & {
  isMetaMask?: boolean
  isBraveWallet?: boolean
  isRabby?: boolean
  isOkxWallet?: boolean
  isCoinbaseWallet?: boolean
  isBitKeep?: boolean
  isTokenPocket?: boolean

  _metamask?: unknown
  _isMetaMask?: boolean
  providers?: AnyProvider[]
  request: (args: { method: string; params?: any[] | object }) => Promise<any>
}

function asProvider(x: any): AnyProvider | null {
  if (!x || typeof x !== 'object') return null
  if (typeof x.request !== 'function') return null
  return x as AnyProvider
}

export function getInjectedProvidersFromWindow(): AnyProvider[] {
  const eth = asProvider((window as any)?.ethereum)
  if (!eth) return []

  const list =
    Array.isArray((eth as any).providers) && (eth as any).providers.length ? (eth as any).providers.map(asProvider).filter(Boolean) : [eth]

  const seen = new Set<any>()
  const uniq: AnyProvider[] = []
  for (const p of list) {
    if (!p) continue
    if (seen.has(p)) continue
    seen.add(p)
    uniq.push(p)
  }
  return uniq
}
