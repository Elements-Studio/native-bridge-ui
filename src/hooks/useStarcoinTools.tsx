import WalletDialog from '@/components/WalletDialog'
import { getStarMaskProvider, tryReconnectStarMask } from '@/lib/starcoinProvider/starMask'
import storage from '@/lib/storage'
import { useGlobalStore } from '@/stores/globalStore'
import type { WalletInfo } from '@/types/domain'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'starcoin_rehydrated'

async function getStarcoinBalance(
  provider: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> },
  address: string,
): Promise<string> {
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

  const disconnect = useCallback(async () => {
    const provider = getStarMaskProvider()
    if (provider) {
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
        const err = error as { message?: string }
        console.log('StarMask wallet_revokePermissions not supported or failed:', err?.message)
      }
    }

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

    const accounts: string[] = await provider.request({ method: 'stc_accounts' })
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
    ({ walletInfo, walletType }: { walletInfo: WalletInfo | null; walletType: string }) => {
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

  return { contextHolder, getBalance, openConnectDialog, disconnect, tryReconnect }
}
