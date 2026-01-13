import WalletDialog from '@/components/WalletDialog'
import { getMetaMask } from '@/lib/evmProvider'
import { useGlobalStore } from '@/stores/globalStore'
import { BrowserProvider, formatEther } from 'ethers'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export default () => {
  const { isEvmConnected } = useGlobalStore()
  const currentIsEvmConnected = useRef(isEvmConnected)
  useEffect(() => {
    currentIsEvmConnected.current = isEvmConnected
  }, [isEvmConnected])
  const [isOpen, setIsOpen] = useState(false)

  const openConnectDialog = useCallback(async () => {
    if (!currentIsEvmConnected.current) {
      setIsOpen(true)
      return
    }
    setIsOpen(false)
  }, [])

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

  return { getBalance, openConnectDialog, contextHolder }
}
