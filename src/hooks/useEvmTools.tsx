import WalletDialog from '@/components/WalletDialog'
import { getAllProviders, getMetaMask } from '@/lib/evmProvider'
import storage from '@/lib/storage'
import { asyncMap } from '@/lib/utils'
import { useGlobalStore } from '@/stores/globalStore'
import { BrowserProvider, formatEther } from 'ethers'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export default () => {
  const { evmWalletInfo, setEvmWalletInfo } = useGlobalStore()
  const currentIsEvmConnected = useRef(!!evmWalletInfo)
  useEffect(() => {
    currentIsEvmConnected.current = !!evmWalletInfo
  }, [evmWalletInfo])
  const [isOpen, setIsOpen] = useState(false)

  const openConnectDialog = useCallback(async () => {
    if (!currentIsEvmConnected.current) {
      setIsOpen(true)
      return
    }
    setIsOpen(false)
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
      } catch {}
    })
    setEvmWalletInfo(null)
    await storage.removeItem('evm_rehydrated')
  }, [setEvmWalletInfo])

  const getBalance = useCallback(async (chainId: string) => {
    if (!currentIsEvmConnected.current) {
      setIsOpen(true)
      return
    }
    setIsOpen(false)
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

  const contextHolder = useMemo(() => {
    return <WalletDialog open={isOpen} onCancel={() => setIsOpen(false)} onOk={() => setIsOpen(false)} />
  }, [isOpen])

  return { contextHolder, getBalance, openConnectDialog, disconnect }
}
