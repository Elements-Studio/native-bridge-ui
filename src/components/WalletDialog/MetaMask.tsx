import metamaskLogo from '@/assets/img/metamask.svg'
import { connectMetaMask, getAllProviders } from '@/lib/evmProvider'
import { normalizeEip1193Error } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useGlobalStore } from '@/stores/globalStore'
import type { WalletInfo } from '@/types/domain'
import { useCallback, useEffect, useState } from 'react'

// type MetaMaskConnectedPayload = {
//   address: string
//   chainId: number
//   balance: string
//   eip1193Provider: EIP1193Provider
// }

type MetaMaskProps = {
  onDialogOk?: () => void
  onChange?: (walletInfo: WalletInfo) => void
  onError?: (error: Error) => void
  className?: string
}

export default function MetaMask({ className, onError, onDialogOk, onChange }: MetaMaskProps) {
  console.log('MetaMask component rendered')
  const [connecting, setConnecting] = useState(false)
  const { currentCoin } = useGlobalStore()

  const handleClick = useCallback(async () => {
    if (connecting) return
    try {
      setConnecting(true)
      const chainId = currentCoin.network.chainId
      const info = await connectMetaMask(chainId)
      if (!info) throw new Error('Failed to connect to MetaMask')
      // onConnected?.({
      //   address: info.address,
      //   chainId: Number(info.network.chainId),
      //   balance: info.balance,
      //   eip1193Provider: info.eip1193Provider,
      // })

      onChange?.(info)
      onDialogOk?.()
    } catch (err) {
      onError?.(normalizeEip1193Error(err))
    } finally {
      setConnecting(false)
    }
  }, [connecting, onError, onDialogOk, onChange, currentCoin.network.chainId])

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
        className={cn(
          'bg-accent/40 hover:bg-accent/30 hover:text-primary-foreground flex items-center space-x-4 rounded-md p-2 backdrop-blur-md transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <img width={34} height={34} src={metamaskLogo} alt="MetaMask Logo" className="grayscale" />
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
        'bg-accent/40 hover:bg-accent/30 hover:text-primary-foreground flex items-center space-x-4 rounded-md p-2 backdrop-blur-md transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <img width={34} height={34} src={metamaskLogo} alt="MetaMask Logo" />
      <div>{connecting ? 'Connecting…' : 'MetaMask'}</div>
    </button>
  )
}
