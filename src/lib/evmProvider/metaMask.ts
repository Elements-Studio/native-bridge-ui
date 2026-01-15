import type { EIP1193Provider, WalletInfo } from '@/types/domain'
import { BrowserProvider, formatEther, toBeHex } from 'ethers'
import idmp from 'idmp'
import { getInjectedProvidersFromWindow } from './_tools'

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

async function getMetaMaskProviderFromWindow(): Promise<EIP1193Provider | null> {
  const providers = getInjectedProvidersFromWindow()
  if (providers.length === 0) return null

  for (const p of providers) {
    try {
      await p.request({ method: 'wallet_getPermissions' })
      return p
    } catch {
      // Provider doesn't support wallet_getPermissions, continue
      return null
    }
  }

  const notImpostor = providers.filter(p => {
    if (p.isBraveWallet) return false
    if (p.isRabby) return false
    if (p.isOkxWallet) return false
    if (p.isCoinbaseWallet) return false
    if (p.isBitKeep) return false
    if (p.isTokenPocket) return false
    return true
  })

  const strong = notImpostor.find(p => !!p._metamask || p._isMetaMask === true)
  if (strong) return strong

  const weak = notImpostor.find(p => p.isMetaMask)
  if (weak) return weak

  return null
}

export async function resolveMetaMaskProviderFromWindow(opts?: {
  timeoutMs?: number

  requireRevoke?: boolean
}): Promise<EIP1193Provider | null> {
  const timeoutMs = opts?.timeoutMs ?? 800
  const requireRevoke = opts?.requireRevoke ?? false

  const providers = getInjectedProvidersFromWindow()
  if (providers.length === 0) return null

  const candidates: AnyProvider[] = []

  const first = (await getMetaMaskProviderFromWindow()) as AnyProvider | null
  if (first) candidates.push(first)

  for (const p of providers) {
    if (!p) continue
    if (!candidates.includes(p)) candidates.push(p)
  }

  const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
    return await Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))])
  }

  const supports = async (p: AnyProvider) => {
    try {
      const res = await withTimeout(p.request({ method: 'wallet_getPermissions' }))

      if (Array.isArray(res)) return true

      return true
    } catch (error: unknown) {
      const err = error as { code?: number }
      if (err?.code === -32601) {
        // Method not supported
      } else {
        // Other error
      }
    }

    if (requireRevoke) {
      try {
        await withTimeout(
          p.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          }),
        )
        return true
      } catch (error: unknown) {
        const err = error as Record<string, unknown>
        if (err?.code === -32601) return false

        return true
      }
    }

    return false
  }

  const filtered = candidates.filter(p => {
    if (!p) return false
    if (p.isBraveWallet) return false
    if (p.isRabby) return false
    if (p.isOkxWallet) return false
    if (p.isCoinbaseWallet) return false
    if (p.isBitKeep) return false
    if (p.isTokenPocket) return false
    return true
  })

  for (const p of filtered) {
    try {
      if (await supports(p)) return p
    } catch (error: unknown) {
      // Continue to next provider
      console.debug('Provider check failed:', error)
    }
  }

  return (first as EIP1193Provider) ?? null
}

async function discoverMetaMaskProvider(timeout = 1200): Promise<EIP1193Provider | null> {
  return new Promise(resolve => {
    let picked: EIP1193Provider | null = null
    const handler = (event: unknown) => {
      const evt = event as { detail?: { info?: { rdns?: string }; provider?: EIP1193Provider } }
      const info = evt?.detail?.info
      const provider = evt?.detail?.provider
      if (!info || !provider) return
      if (info.rdns === 'io.metamask') picked = provider
    }
    window.addEventListener('eip6963:announceProvider', handler)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handler)
      resolve(picked)
    }, timeout)
  })
}
const _getProvider = async (): Promise<EIP1193Provider | null> => {
  return (await discoverMetaMaskProvider()) || (await getMetaMaskProviderFromWindow())
}

const key = Symbol('getMetaMaskProvider')
export const getProvider = () =>
  idmp(
    key,
    async () => {
      const mm = await _getProvider()
      if (mm) return mm

      // 避免 idmp 缓存 null
      idmp.flush(key)
      return null
    },
    {
      maxAge: Infinity,
      maxRetry: 0,
      onBeforeRetry() {
        console.log('Retrying to get MetaMask provider...')
      },
    },
  )

export const connect = async (targetChainId?: string): Promise<WalletInfo | null> => {
  const mm = await getProvider()
  if (!mm) throw new Error('MetaMask not detected')

  // 如果指定了 chainId，先切换网络
  if (targetChainId) {
    try {
      await mm.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      })
    } catch (error: unknown) {
      const err = error as Record<string, unknown>
      if (err?.code === -32603) {
        throw new Error(`Network ${targetChainId} not found in wallet`)
      }
      throw error
    }
  }

  const ethersProvider = new BrowserProvider(mm)
  const signer = await ethersProvider.getSigner()
  const address = await signer.getAddress()
  const network = await ethersProvider.getNetwork()
  const balanceBigInt = await ethersProvider.getBalance(address)
  const balance = formatEther(balanceBigInt)

  return {
    network: {
      name: network.name,
      chainId: toBeHex(network.chainId),
    } as WalletInfo['network'],
    address,
    balance,
  }
}
export const tryReconnect = async (): Promise<WalletInfo | null> => {
  const mm = await getProvider()
  if (!mm) return null

  try {
    const accounts = (await mm.request({ method: 'eth_accounts' })) as string[]
    if (accounts.length === 0) return null

    return connect()
  } catch {
    return null
  }
}
