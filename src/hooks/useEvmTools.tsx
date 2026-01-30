import WalletDialog from '@/components/WalletDialog'
import { getAllProviders, getMetaMask, tryReconnectMetaMask } from '@/lib/evmProvider'
import storage from '@/lib/storage'
import { asyncMap } from '@/lib/utils'
import { useGlobalStore } from '@/stores/globalStore'
import type { Callbacks, EIP1193Provider, WalletInfo } from '@/types/domain'
import { BrowserProvider, Contract, formatEther, formatUnits } from 'ethers'
import idmp from 'idmp'
import { useCallback, useMemo, useState } from 'react'

const STORAGE_KEY = 'evm_rehydrated'

let evmListenerInitialized = false
const boundEvmProviders = new WeakSet<EIP1193Provider>()

export default function useEvmTools() {
  const setEvmWalletInfo = useGlobalStore(state => state.setEvmWalletInfo)

  const [isOpen, setIsOpen] = useState(false)

  const openConnectDialog = useCallback(() => {
    setIsOpen(true)
  }, [])

  const initListener = useCallback(async (callbacks: Callbacks = {}) => {
    if (evmListenerInitialized) return
    evmListenerInitialized = true

    try {
      const { providers } = await getAllProviders()

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

      providers.forEach(provider => {
        if (!provider || boundEvmProviders.has(provider)) return
        try {
          if (typeof provider.on === 'function') {
            provider.on('accountsChanged', handleAccountsChanged)
            provider.on('disconnect', handleDisconnect)
          } else if (typeof provider.addListener === 'function') {
            provider.addListener('accountsChanged', handleAccountsChanged)
            provider.addListener('disconnect', handleDisconnect)
          }
          boundEvmProviders.add(provider)
        } catch (err) {
          console.debug('bind EVM provider listeners failed:', err)
        }
      })
    } catch (err) {
      console.debug('initListener failed:', err)
    }
  }, [])

  const disconnect = useCallback(async () => {
    const { providers } = await getAllProviders()
    await asyncMap(providers, async provider => {
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [
            {
              eth_accounts: {},
            },
          ],
        })
      } catch (error: unknown) {
        console.debug('wallet_revokePermissions failed:', error)
      }
    })

    setEvmWalletInfo(null)
    await storage.removeItem(STORAGE_KEY)
  }, [setEvmWalletInfo])

  const tryReconnect = useCallback(async () => {
    const localCachedInfo = await storage.getItem<Partial<WalletInfo>>(STORAGE_KEY)

    if (!localCachedInfo) return
    setEvmWalletInfo(localCachedInfo as WalletInfo)
    const walletInfo = await tryReconnectMetaMask()
    if (walletInfo) {
      setEvmWalletInfo(walletInfo)

      await storage.setItem(STORAGE_KEY, walletInfo)
    } else {
      setEvmWalletInfo(null)

      await storage.removeItem(STORAGE_KEY)
    }
  }, [setEvmWalletInfo])

  const _getBalance = useCallback(async (chainId: string, ca?: string | null) => {
    try {
      const mm = await getMetaMask()
      if (!mm) return { balance: '0', rawBalance: 0n }

      console.log('[getBalance] request', { chainId, ca })
      await mm.request({
        method: 'wallet_switchEthereumChain',
        params: [
          {
            chainId,
          },
        ],
      })
      const provider = new BrowserProvider(mm)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()
      console.log('[getBalance] network', { chainId: network.chainId, address })

      if (!ca) {
        const rawBalance = await provider.getBalance(address)
        console.log('[getBalance] native balance', { rawBalance: rawBalance.toString() })
        return { balance: formatEther(rawBalance), rawBalance }
      }

      const code = await provider.getCode(ca)
      console.log('[getBalance] token code', { ca, codeLen: code.length, code })
      const erc20 = new Contract(
        ca,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        provider,
      )

      const rawBalance = await erc20.balanceOf(address)
      let decimals = 0
      try {
        decimals = await erc20.decimals()
      } catch (err) {
        console.warn('[getBalance] decimals() failed, fallback to 0', { ca, err })
      }
      console.log('[getBalance] token result', { ca, rawBalance: rawBalance.toString(), decimals })
      return { balance: formatUnits(rawBalance, decimals), rawBalance, decimals }
    } catch (err) {
      console.error('getBalance error:', err)
      throw err
    }
  }, [])

  const getBalance = (chainId: string, ca?: string | null) => {
    const key = `getBalance:${chainId}:${ca || 'native'}`
    return idmp(key, async () => {
      const res = await _getBalance(chainId, ca)
      console.log('getBalance result:', res, 2222222)
      if (res) return res
      idmp.flush(key)
    })
  }

  const handleCancel = useCallback(() => {
    console.log('canceled')
    setIsOpen(false)
  }, [])

  const handleOk = useCallback(
    ({ walletInfo, walletType }: { walletInfo: WalletInfo | null; walletType?: 'EVM' | 'STARCOIN' }) => {
      if (walletType === 'EVM' && walletInfo) {
        setEvmWalletInfo(walletInfo)
        storage.setItem(STORAGE_KEY, walletInfo)
      }
      setIsOpen(false)
    },
    [setEvmWalletInfo],
  )

  const contextHolder = useMemo(() => {
    return <WalletDialog open={isOpen} onCancel={handleCancel} onOk={handleOk} walletType="EVM" />
  }, [isOpen, handleCancel, handleOk])

  return { contextHolder, initListener, getBalance, openConnectDialog, disconnect, tryReconnect }
}
