import metamaskLogo from '@/assets/img/metamask.svg'
import { getAllProviders, getMetaMask } from '@/lib/evmProvider'
import { normalizeEip1193Error } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EIP1193Provider, WalletInfo } from '@/types/domain'
import { BrowserProvider, formatEther } from 'ethers'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

type MetaMaskConnectedPayload = {
  address: string
  chainId: number
  balance: string
  eip1193Provider: EIP1193Provider
}

type MetaMaskProps = {
  onDialogOk?: () => void
  onChange?: (walletInfo: WalletInfo) => void
  onConnected?: (payload: MetaMaskConnectedPayload) => void
  onError?: (error: Error) => void
} & React.ComponentProps<'button'>

export default function MetaMask({ className, onConnected, onError, onDialogOk, onChange, ...props }: MetaMaskProps) {
  console.log('MetaMask component rendered')
  const [connecting, setConnecting] = useState(false)
  const providerRef = useRef<EIP1193Provider | null>(null)

  useEffect(() => {
    ;(async () => {
      const mm = await getMetaMask()
      providerRef.current = mm
    })()
  }, [])

  const handleClick = useCallback(async () => {
    if (connecting) return
    try {
      setConnecting(true)

      const mm = providerRef.current || (await getMetaMask())
      if (!mm) throw new Error('MetaMask not detected')
      providerRef.current = mm

      const accounts: string[] = await mm.request({ method: 'eth_accounts' })
      if (!accounts || accounts.length === 0) {
        await mm.request({ method: 'eth_requestAccounts' })
      }

      const ethersProvider = new BrowserProvider(mm as any)
      const signer = await ethersProvider.getSigner()
      const address = await signer.getAddress()
      const network = await ethersProvider.getNetwork()
      const balanceBigInt = await ethersProvider.getBalance(address)
      const balance = formatEther(balanceBigInt)

      onConnected?.({
        address,
        chainId: Number(network.chainId),
        balance,
        eip1193Provider: mm,
      })

      onChange?.({
        network,
        address,
        balanceBigInt,
        balance,
      })
      onDialogOk?.()
    } catch (err) {
      onError?.(normalizeEip1193Error(err))
    } finally {
      setConnecting(false)
    }
  }, [connecting, onConnected, onError, onDialogOk, onChange])

  const [hasInstalled, setHasInstalled] = useState(true)
  useEffect(() => {
    getAllProviders().then(providers => {
      setHasInstalled(!!providers.hasMetaMask)
    })
  }, [])
  if (!hasInstalled) {
    return (
      <a
        href="https://metamask.io/"
        target="_blank"
        rel="noreferrer noopener"
        className={cn('flex items-center space-x-4 rounded-md border p-2 disabled:cursor-not-allowed disabled:opacity-60', className)}
      >
        <img src={metamaskLogo} alt="MetaMask Logo" className="grayscale" />
        <span>MetaMask</span>
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={connecting}
      className={cn(
        'flex items-center space-x-4 rounded-md border p-2 hover:border-gray-300 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <img src={metamaskLogo} alt="MetaMask Logo" />
      <div>{connecting ? 'Connecting…' : 'MetaMask'}</div>
    </button>
  )
}
