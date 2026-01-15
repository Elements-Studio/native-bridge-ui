import WalletDialog from '@/components/WalletDialog'
import { getAllProviders, getMetaMask, tryReconnectMetaMask } from '@/lib/evmProvider'
import storage from '@/lib/storage'
import { asyncMap } from '@/lib/utils'
import { useGlobalStore } from '@/stores/globalStore'
import type { WalletInfo } from '@/types/domain'
import { BrowserProvider, formatEther } from 'ethers'
import { useCallback, useMemo, useState } from 'react'

const STORAGE_KEY = 'evm_rehydrated'
export default function useEvmTools() {
  const { setEvmWalletInfo } = useGlobalStore()

  const [isOpen, setIsOpen] = useState(false)

  const openConnectDialog = useCallback(() => {
    setIsOpen(true)
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
        // wallet_revokePermissions not supported, continue
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

  const getBalance = useCallback(async (chainId: string) => {
    const mm = await getMetaMask()
    if (!mm) return { balance: '0' }

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
    const address = await signer.getAddress() // 原生代币余额
    const network = await provider.getNetwork()
    console.log('Switched to network:', network)
    const balance = await provider.getBalance(address)
    return { balance: formatEther(balance) }
  }, [])

  const handleCancel = useCallback(() => {
    console.log('canceled')
    setIsOpen(false)
  }, [])

  const handleOk = useCallback(
    ({ walletInfo, walletType }: { walletInfo: WalletInfo | null; walletType: string }) => {
      if (walletType === 'EVM' && walletInfo) {
        setEvmWalletInfo(walletInfo)
        storage.setItem(STORAGE_KEY, walletInfo)
      }
      setIsOpen(false)
    },
    [setEvmWalletInfo],
  )

  const contextHolder = useMemo(() => {
    return <WalletDialog open={isOpen} onCancel={handleCancel} onOk={handleOk} />
  }, [isOpen, handleCancel, handleOk])

  return { contextHolder, getBalance, openConnectDialog, disconnect, tryReconnect }
}
