import { getMetaMask, tryReconnectMetaMask as tryReconnectEvm } from '@/lib/evmProvider'
import storage from '@/lib/storage'
import { useGlobalStore } from '@/stores/globalStore'
import type { WalletInfo } from '@/types/domain'
import { useEffect } from 'react'

export default function GlobalInitial() {
  const { setEvmWalletInfo } = useGlobalStore()
  useEffect(() => {
    ;(async () => {
      getMetaMask() // 初始化并缓存 MetaMask 实例到 idmp，加快后续速度

      {
        //EMV init reconnection
        const localCachedInfo = await storage.getItem<Partial<WalletInfo>>('evm_rehydrated')

        if (!localCachedInfo) return
        setEvmWalletInfo(localCachedInfo as WalletInfo)

        const walletInfo = await tryReconnectEvm()
        if (walletInfo) {
          setEvmWalletInfo(walletInfo)

          await storage.setItem('evm_rehydrated', walletInfo)
        } else {
          setEvmWalletInfo(null)

          await storage.removeItem('evm_rehydrated')
        }
      }
    })()
  }, [setEvmWalletInfo])

  return null
}
