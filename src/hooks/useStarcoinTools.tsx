import WalletDialog from '@/components/WalletDialog'
import { getStarMaskProvider, tryReconnectStarMask, type StarcoinProvider } from '@/lib/starcoinProvider'
import storage from '@/lib/storage'
import { useGlobalStore } from '@/stores/globalStore'
import type { Callbacks, WalletInfo } from '@/types/domain'

import idmp from 'idmp'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'starcoin_rehydrated'

let starcoinListenerInitialized = false
const boundStarcoinProviders = new WeakSet<StarcoinProvider>()

function normalizeTokenCode(code: string): string {
  const trimmed = code.trim()
  const match = trimmed.match(/^(0x[0-9a-fA-F]+)::(.+)$/)
  if (!match) return trimmed.toLowerCase()
  const [, addr, rest] = match
  const clean = addr.slice(2).toLowerCase()
  const padded = clean.padStart(32, '0')
  return `0x${padded}::${rest.toLowerCase()}`
}

function normalizeTypeTagAddress(code: string): string {
  const trimmed = code.trim()
  const match = trimmed.match(/^(0x[0-9a-fA-F]+)::(.+)$/)
  if (!match) return trimmed
  const [, addr, rest] = match
  const clean = addr.slice(2)
  const padded = clean.padStart(32, '0')
  return `0x${padded}::${rest}`
}

function parseStarcoinBalanceResource(resource: unknown): bigint | null {
  const data = resource as { value?: Array<{ name: string; value?: { Vector?: Array<{ U128?: string }> } }> } | undefined
  if (!data || !data.value) return null
  const tokenField = data.value.find(field => field.name === 'token')
  if (!tokenField || !tokenField.value || !tokenField.value.Vector) return null
  const balanceValue = tokenField.value.Vector[0]?.U128
  if (!balanceValue) return null
  try {
    return BigInt(balanceValue)
  } catch {
    return null
  }
}

function parseStarcoinTokenValue(resource: unknown): bigint | null {
  const rawHex = (resource as { raw?: string } | undefined)?.raw
  if (typeof rawHex === 'string' && rawHex.startsWith('0x')) {
    try {
      const hex = rawHex.slice(2)
      if (hex.length % 2 === 0 && hex.length >= 2) {
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
        }
        let value = 0n
        for (let i = bytes.length - 1; i >= 0; i -= 1) {
          value = (value << 8n) + BigInt(bytes[i] ?? 0)
        }
        return value
      }
    } catch {
      return null
    }
  }

  const raw = resource as { value?: unknown[] } | undefined
  const rawValue =
    raw &&
    Array.isArray(raw.value) &&
    raw.value[0] &&
    Array.isArray(raw.value[0]) &&
    (raw.value[0] as unknown[])[1] &&
    typeof (raw.value[0] as unknown[])[1] === 'object'
      ? ((raw.value[0] as unknown[])[1] as { Struct?: { value?: unknown[] } })?.Struct?.value
      : undefined
  if (Array.isArray(rawValue) && rawValue[0] && Array.isArray(rawValue[0])) {
    const possible = (rawValue[0] as unknown[])[1] as { U128?: string } | undefined
    if (possible?.U128) {
      try {
        return BigInt(possible.U128)
      } catch {
        return null
      }
    }
  }

  const direct = resource as { token?: { value?: string | number | bigint } } | undefined
  if (direct?.token?.value !== undefined && direct.token.value !== null) {
    try {
      return typeof direct.token.value === 'bigint' ? direct.token.value : BigInt(direct.token.value)
    } catch {
      return null
    }
  }

  const jsonWrapped = resource as { json?: { token?: { value?: string | number | bigint } } } | undefined
  if (jsonWrapped?.json?.token?.value !== undefined && jsonWrapped.json.token.value !== null) {
    try {
      return typeof jsonWrapped.json.token.value === 'bigint' ? jsonWrapped.json.token.value : BigInt(jsonWrapped.json.token.value)
    } catch {
      return null
    }
  }

  return parseStarcoinBalanceResource(resource)
}

function formatWithDecimals(value: bigint, decimals: number): string {
  if (decimals <= 0) return value.toString()
  const factor = 10n ** BigInt(decimals)
  const integer = value / factor
  const fraction = value % factor
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fractionStr.length ? `${integer.toString()}.${fractionStr}` : integer.toString()
}

async function getStarcoinBalance(
  provider: StarcoinProvider,
  address: string,
  typeTag?: string,
  decimals = 9,
): Promise<{ balance: string; rawBalance: bigint; decimals: number }> {
  try {
    const tag = normalizeTypeTagAddress(typeTag ?? '0x1::STC::STC')
    console.info('[StarcoinBalance] request', { address, tag })
    let resource: unknown
    try {
      resource = await provider.request({
        method: 'state.get_resource',
        params: [address, `0x1::Account::Balance<${tag}>`],
      })
      console.info('[StarcoinBalance] state.get_resource ok', { tag, resource })
      try {
        console.info('[StarcoinBalance] state.get_resource json', JSON.stringify(resource))
      } catch (err) {
        console.warn('[StarcoinBalance] state.get_resource json failed', err)
      }
    } catch (error) {
      console.warn('state.get_resource failed, fallback to contract.get_resource:', error)
      resource = await provider.request({
        method: 'contract.get_resource',
        params: [address, `0x1::Account::Balance<${tag}>`],
      })
      console.info('[StarcoinBalance] contract.get_resource ok', { tag, resource })
      try {
        console.info('[StarcoinBalance] contract.get_resource json', JSON.stringify(resource))
      } catch (err) {
        console.warn('[StarcoinBalance] contract.get_resource json failed', err)
      }
    }
    const raw = parseStarcoinTokenValue(resource)
    console.info('[StarcoinBalance] parsed', { tag, raw })
    if (raw === null) return { balance: '0', rawBalance: 0n, decimals }
    return { balance: formatWithDecimals(raw, decimals), rawBalance: raw, decimals }
  } catch (error) {
    console.warn('Failed to get Starcoin balance:', error)
    return { balance: '0', rawBalance: 0n, decimals }
  }
}

export default function useStarcoinTools() {
  const setStarcoinWalletInfo = useGlobalStore(state => state.setStarcoinWalletInfo)
  const starcoinWalletInfo = useGlobalStore(state => state.starcoinWalletInfo)

  const [isOpen, setIsOpen] = useState(false)

  const starcoinWalletInfoRef = useRef(starcoinWalletInfo)
  useEffect(() => {
    starcoinWalletInfoRef.current = starcoinWalletInfo
  }, [starcoinWalletInfo])

  const openConnectDialog = useCallback(() => {
    setIsOpen(true)
  }, [])

  const initListener = useCallback(async (callbacks: Callbacks = {}) => {
    if (starcoinListenerInitialized) return
    starcoinListenerInitialized = true

    try {
      const provider = getStarMaskProvider()
      if (!provider) return

      const handleAccountsChanged = (accounts: unknown) => {
        try {
          if (!accounts || (Array.isArray(accounts) && accounts.length === 0)) {
            callbacks.onUnauthenticated?.()
          }
        } catch (err) {
          console.debug('handleAccountsChanged error', err)
        }
      }

      const handleDisconnect = () => {
        callbacks.onUnauthenticated?.()
      }

      if (boundStarcoinProviders.has(provider)) return

      try {
        if (typeof provider.on === 'function') {
          provider.on('accountsChanged', handleAccountsChanged)
          provider.on('disconnect', handleDisconnect)
        } else if (typeof provider.addListener === 'function') {
          provider.addListener('accountsChanged', handleAccountsChanged)
          provider.addListener('disconnect', handleDisconnect)
        }
        boundStarcoinProviders.add(provider)
      } catch (err) {
        console.debug('bind Starcoin provider listeners failed:', err)
      }
    } catch (err) {
      console.debug('initListener failed:', err)
    }
  }, [])

  const disconnect = useCallback(async () => {
    setStarcoinWalletInfo(null)
    await storage.removeItem(STORAGE_KEY)
  }, [setStarcoinWalletInfo])

  const tryReconnect = useCallback(async () => {
    const localCachedInfo = await storage.getItem<Partial<WalletInfo>>(STORAGE_KEY)

    if (!localCachedInfo) return
    setStarcoinWalletInfo(localCachedInfo as WalletInfo)
    const walletInfo = await tryReconnectStarMask()
    if (walletInfo) {
      setStarcoinWalletInfo(walletInfo)
      await storage.setItem(STORAGE_KEY, walletInfo)
    } else {
      setStarcoinWalletInfo(null)
      await storage.removeItem(STORAGE_KEY)
    }
  }, [setStarcoinWalletInfo])

  const _getBalance = useCallback(async (chainId: string, ca?: string | null) => {
    const provider = getStarMaskProvider()
    if (!provider) return { balance: '0', rawBalance: 0n, decimals: 0 }

    console.info('[StarcoinBalance] getBalance', { chainId, ca })

    const accounts = (await provider.request({ method: 'stc_accounts' })) as string[]
    const address = accounts?.[0]
    if (!address) return { balance: '0', rawBalance: 0n, decimals: 0 }

    const numericChainId = parseInt(chainId, 16)
    let currentChainId: number | null = null
    try {
      const chain = await provider.request({ method: 'chain.id' })
      currentChainId = typeof chain === 'string' ? parseInt(chain, 16) : Number(chain)
    } catch (error) {
      console.warn('Failed to get starcoin chain.id:', error)
    }
    if (currentChainId && currentChainId !== numericChainId) {
      console.warn(`[StarcoinBalance] network mismatch: expected ${numericChainId}, got ${currentChainId}. Please switch in StarMask.`)
    }

    const targetTag = ca ?? '0x1::STC::STC'
    const targetDecimals = normalizeTokenCode(targetTag).endsWith('::usdt::usdt') ? 6 : 9
    console.info('[StarcoinBalance] query', { address, targetTag, targetDecimals })
    return getStarcoinBalance(provider, address, targetTag, targetDecimals)
  }, [])

  const getBalance = (chainId: string, ca?: string | null) => {
    const key = `getStarcoinBalance:${chainId}:${ca || 'native'}`
    return idmp(key, async () => {
      const res = await _getBalance(chainId, ca)
      if (res) return res
      idmp.flush(key)
    })
  }

  type ScriptFunctionPayload = {
    type: 'script_function'
    function_id: string
    type_args?: string[]
    args?: Array<string | number | boolean | object>
  }

  type StarcoinSendTxParams = {
    from?: string
    payload?: ScriptFunctionPayload
    data?: string
    max_gas_amount?: string | number
    gas_unit_price?: string | number
    gas_token_code?: string
    expiration_timestamp_secs?: string | number
  }

  const sendTransaction = useCallback(async (params: StarcoinSendTxParams) => {
    const provider = getStarMaskProvider()
    if (!provider) throw new Error('StarMask not found: window.starcoin is missing')

    let accounts = (await provider.request({ method: 'stc_accounts' })) as string[]
    if (!accounts || accounts.length === 0) {
      accounts = (await provider.request({ method: 'stc_requestAccounts' })) as string[]
    }
    const from = params.from ?? accounts?.[0]
    if (!from) throw new Error('No Starcoin account')

    const tx = { ...params, from }
    console.info('[StarMask][sendTransaction] sender:', from)
    console.info('[StarMask][sendTransaction] data:', tx.data)
    console.info('[StarMask][sendTransaction] payload:', tx.payload)
    console.info('[StarMask][sendTransaction] payload(json):', JSON.stringify(tx.payload))
    const result = await provider.request({ method: 'stc_sendTransaction', params: [tx] })
    console.log('[StarMask][sendTransaction] result:', result)
    return result
  }, [])

  const submitHexTransaction = useCallback(async (rawTxHex: string) => {
    const provider = getStarMaskProvider()
    if (!provider) throw new Error('StarMask not found: window.starcoin is missing')
    return provider.request({ method: 'txpool.submit_hex_transaction', params: [rawTxHex] })
  }, [])

  const handleCancel = useCallback(() => {
    console.log('canceled')
    setIsOpen(false)
  }, [])

  const handleOk = useCallback(
    ({ walletInfo, walletType }: { walletInfo: WalletInfo | null; walletType?: 'EVM' | 'STARCOIN' }) => {
      if (walletType === 'STARCOIN' && walletInfo) {
        setStarcoinWalletInfo(walletInfo)
        storage.setItem(STORAGE_KEY, walletInfo)
      }
      setIsOpen(false)
    },
    [setStarcoinWalletInfo],
  )

  const contextHolder = useMemo(() => {
    return <WalletDialog open={isOpen} onCancel={handleCancel} onOk={handleOk} walletType="STARCOIN" />
  }, [isOpen, handleCancel, handleOk])

  return {
    contextHolder,
    getBalance,
    openConnectDialog,
    initListener,
    disconnect,
    tryReconnect,
    sendTransaction,
    submitHexTransaction,
  }
}
