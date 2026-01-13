import type { EIP1193Provider, WalletInfo } from '@/types/domain'
import { BrowserProvider, formatEther } from 'ethers'
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
  request: (args: { method: string; params?: any[] | object }) => Promise<any>
}

async function getMetaMaskProviderFromWindow(): Promise<EIP1193Provider | null> {
  const providers = getInjectedProvidersFromWindow()
  if (providers.length === 0) return null

  for (const p of providers) {
    try {
      await p.request({ method: 'wallet_getPermissions' })
      return p
    } catch (e) {
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
    } catch (e: any) {
      if (e?.code === -32601) {
      } else {
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
      } catch (e: any) {
        if (e?.code === -32601) return false

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
    } catch {}
  }

  return (first as any) ?? null
}

async function discoverMetaMaskProvider(timeout = 1200): Promise<EIP1193Provider | null> {
  return new Promise(async resolve => {
    let picked: any | null = null
    const handler = (event: any) => {
      const info = event?.detail?.info
      const provider = event?.detail?.provider
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
export const getProvider = () =>
  idmp('getMetaMaskProvider', _getProvider, {
    maxAge: Infinity,
    maxRetry: 1,
    minRetryDelay: 3000,
    onBeforeRetry() {
      console.log('Retrying to get MetaMask provider...')
    },
  })

export const connect = async (): Promise<WalletInfo | null> => {
  const mm = await getProvider()
  if (!mm) throw new Error('MetaMask not detected')
  // 获取完整的 WalletInfo
  const ethersProvider = new BrowserProvider(mm as any)
  const signer = await ethersProvider.getSigner()
  const address = await signer.getAddress()
  const network = await ethersProvider.getNetwork()
  const balanceBigInt = await ethersProvider.getBalance(address)
  const balance = formatEther(balanceBigInt)

  return {
    network,
    address,
    balanceBigInt,
    balance,
  }
}
export const tryReconnect = async (): Promise<WalletInfo | null> => {
  const mm = await getProvider()
  if (!mm) return null

  try {
    const accounts: string[] = await mm.request({ method: 'eth_accounts' })
    if (accounts.length === 0) return null

    return connect()
  } catch (e) {
    return null
  }
}
