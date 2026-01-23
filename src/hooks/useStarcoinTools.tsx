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

function parseListResourceBalance(
  resources: Record<string, { json?: { token?: { value?: string | number | bigint } } }>,
): Record<string, bigint> {
  const balances: Record<string, bigint> = {}
  for (const key of Object.keys(resources)) {
    const normalizedKey = key.toLowerCase()
    if (!normalizedKey.startsWith('0x00000000000000000000000000000001::account::balance<')) continue
    const tokenCode = key.slice(key.indexOf('<') + 1, key.lastIndexOf('>'))
    const rawValue = resources[key]?.json?.token?.value
    if (rawValue === undefined || rawValue === null) continue
    try {
      const value = typeof rawValue === 'bigint' ? rawValue : BigInt(rawValue)
      balances[normalizeTokenCode(tokenCode)] = value
    } catch {
      continue
    }
  }
  return balances
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
    const tag = typeTag ?? '0x1::STC::STC'
    const resource = await provider.request({
      method: 'contract.get_resource',
      params: [address, `0x1::Account::Balance<${tag}>`],
    })
    const raw = parseStarcoinBalanceResource(resource)
    if (raw === null) return { balance: '0', rawBalance: 0n, decimals }
    return { balance: formatWithDecimals(raw, decimals), rawBalance: raw, decimals }
  } catch (error) {
    console.warn('Failed to get Starcoin balance:', error)
    return { balance: '0', rawBalance: 0n, decimals }
  }
}

export default function useStarcoinTools() {
  const { setStarcoinWalletInfo, starcoinWalletInfo } = useGlobalStore()

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

    console.log('Getting balance for chainId:', chainId)

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
      console.warn(`Starcoin network mismatch: expected ${numericChainId}, got ${currentChainId}. Please switch in StarMask.`)
    }

    const targetTags = ca ? (ca.includes('::') ? [ca] : [`${ca}::USDT::USDT`]) : ['0x1::STC::STC']

    let balanceFromList: { raw: bigint; decimals: number } | null = null
    try {
      const listResult = await provider.request({
        method: 'state.list_resource',
        params: [address, { decode: true }],
      })
      const resources =
        (listResult as { resources?: Record<string, { json?: { token?: { value?: string | number | bigint } } }> } | undefined)
          ?.resources ??
        (listResult as Record<string, { json?: { token?: { value?: string | number | bigint } } }>) ??
        null
      if (resources) {
        const balances = parseListResourceBalance(resources)
        for (const tag of targetTags) {
          const normalized = normalizeTokenCode(tag)
          if (balances[normalized] !== undefined) {
            const decimals = normalized.endsWith('::usdt::usdt') ? 6 : 9
            balanceFromList = { raw: balances[normalized], decimals }
            break
          }
        }
      }
    } catch (error) {
      console.warn('state.list_resource failed, fallback to get_resource:', error)
    }

    if (balanceFromList) {
      return {
        balance: formatWithDecimals(balanceFromList.raw, balanceFromList.decimals),
        rawBalance: balanceFromList.raw,
        decimals: balanceFromList.decimals,
      }
    }

    const fallbackTag = targetTags[0]
    const fallbackDecimals = normalizeTokenCode(fallbackTag).endsWith('::usdt::usdt') ? 6 : 9
    return getStarcoinBalance(provider, address, fallbackTag, fallbackDecimals)
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
