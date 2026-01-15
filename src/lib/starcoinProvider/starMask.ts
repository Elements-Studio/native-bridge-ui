import type { WalletInfo } from '@/types/domain'

type StarcoinProvider = {
  isStarMask?: boolean
  request: (args: { method: string; params?: (string | object)[] | object }) => Promise<string | number | object>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

const NETWORK_LABELS: Record<number, string> = {
  1: 'Mainnet',
  251: 'Barnard',
  252: 'Proxima',
  253: 'Halley',
}

export function getStarMaskProvider(): StarcoinProvider | null {
  const p = (window as Record<string, unknown>).starcoin as StarcoinProvider | undefined
  if (!p || typeof p.request !== 'function') return null

  if (p.isStarMask === false) return null
  return p
}

async function getStarcoinBalance(provider: StarcoinProvider, address: string): Promise<string> {
  try {
    const resource = (await provider.request({
      method: 'contract.get_resource',
      params: [address, '0x1::Account::Balance<0x1::STC::STC>'],
    })) as { value?: Array<{ name: string; value?: { Vector?: Array<{ U128?: string }> } }> } | undefined

    if (!resource || !resource.value) {
      return '0.0000'
    }

    const tokenField = resource.value.find(field => field.name === 'token')
    if (!tokenField || !tokenField.value || !tokenField.value.Vector) {
      return '0.0000'
    }

    const balanceValue = tokenField.value.Vector[0]?.U128
    if (!balanceValue) {
      return '0.0000'
    }

    return (Number(balanceValue) / 1e9).toFixed(4)
  } catch (error) {
    console.warn('Failed to get Starcoin balance:', error)
    return '0.0000'
  }
}

export async function connectStarMask(targetChainId?: number): Promise<WalletInfo> {
  const provider = getStarMaskProvider()
  if (!provider) {
    throw new Error('StarMask not found: window.starcoin is missing')
  }

  const accounts: string[] = await provider.request({ method: 'stc_requestAccounts' })
  const account = accounts?.[0]
  if (!account) throw new Error('No account returned from StarMask')

  let chainId: string | number | null = null
  try {
    chainId = await provider.request({ method: 'chain.id' })
  } catch (error) {
    console.warn('Failed to get chain.id, using default:', error)
    chainId = 1
  }

  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId || 1

  if (targetChainId && numericChainId !== targetChainId) {
    console.warn(`Network mismatch: expected ${targetChainId}, got ${numericChainId}. Please switch network manually in StarMask.`)
  }

  const balance = await getStarcoinBalance(provider, account)

  const finalChainId = targetChainId || numericChainId
  return {
    address: account,
    network: {
      name: NETWORK_LABELS[finalChainId] || 'Unknown',
      chainId: `0x${finalChainId.toString(16)}`,
    },
    balance,
  }
}

export async function tryReconnectStarMask(): Promise<WalletInfo | null> {
  const provider = getStarMaskProvider()
  if (!provider) return null

  try {
    const accounts: string[] = await provider.request({ method: 'stc_accounts' })
    if (!accounts || accounts.length === 0) return null

    const account = accounts[0]

    let chainId: string | number | null = null
    try {
      chainId = await provider.request({ method: 'chain.id' })
    } catch (error) {
      console.warn('Failed to get chain.id in reconnect:', error)
      chainId = 1
    }

    const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId || 1

    const balance = await getStarcoinBalance(provider, account)

    return {
      address: account,
      network: {
        name: NETWORK_LABELS[numericChainId] || 'Unknown',
        chainId: `0x${numericChainId.toString(16)}`,
      },
      balance,
    }
  } catch {
    return null
  }
}

export function subscribeStarMask(
  provider: StarcoinProvider,
  onUpdate: (update: { type: string; accounts?: string[]; chainId?: unknown }) => void,
) {
  const handleAccountsChanged = (accounts: string[]) => {
    onUpdate({ type: 'accountsChanged', accounts })
  }
  const handleChainChanged = (cid: unknown) => {
    onUpdate({ type: 'chainChanged', chainId: cid })
  }

  provider.on?.('accountsChanged', handleAccountsChanged)
  provider.on?.('chainChanged', handleChainChanged)

  return () => {
    provider.removeListener?.('accountsChanged', handleAccountsChanged)
    provider.removeListener?.('chainChanged', handleChainChanged)
  }
}
