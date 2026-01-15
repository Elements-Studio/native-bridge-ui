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
  request: (args: { method: string; params?: (string | object)[] | object }) => Promise<string | number | object>
}

function asProvider(x: unknown): AnyProvider | null {
  const provider = x as Record<string, unknown> | null
  if (!provider || typeof provider !== 'object') return null
  if (typeof provider.request !== 'function') return null
  return provider as AnyProvider
}

export function getInjectedProvidersFromWindow(): AnyProvider[] {
  const eth = asProvider((window as unknown as Record<string, unknown>)?.ethereum)
  if (!eth) return []

  const providers = (eth as Record<string, unknown>).providers
  const list =
    Array.isArray(providers) && (providers as unknown[]).length
      ? (providers as unknown[]).map(asProvider).filter((p): p is AnyProvider => p !== null)
      : [eth]

  const seen = new Set<AnyProvider>()
  const uniq: AnyProvider[] = []
  for (const p of list) {
    if (!p) continue
    if (seen.has(p)) continue
    seen.add(p)
    uniq.push(p)
  }
  return uniq
}
