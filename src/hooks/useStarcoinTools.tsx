import WalletDialog from '@/components/WalletDialog'
import { getStarMaskProvider, tryReconnectStarMask, type StarcoinProvider } from '@/lib/starcoinProvider/starMask'
import storage from '@/lib/storage'
import { useGlobalStore } from '@/stores/globalStore'
import type { Callbacks, WalletInfo } from '@/types/domain'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'starcoin_rehydrated'

let starcoinListenerInitialized = false
const boundStarcoinProviders = new WeakSet<StarcoinProvider>()

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

  const getBalance = useCallback(async (chainId: string) => {
    const provider = getStarMaskProvider()
    if (!provider) return { balance: '0' }

    console.log('Getting balance for chainId:', chainId)

    const accounts = (await provider.request({ method: 'stc_accounts' })) as string[]
    const address = accounts?.[0]
    if (!address) return { balance: '0' }

    const balance = await getStarcoinBalance(provider, address)

    console.log('Switched to Starcoin network:', parseInt(chainId, 16))
    return { balance }
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
    return <WalletDialog open={isOpen} onCancel={handleCancel} onOk={handleOk} />
  }, [isOpen, handleCancel, handleOk])

  return { contextHolder, getBalance, openConnectDialog, initListener, disconnect, tryReconnect }
}
