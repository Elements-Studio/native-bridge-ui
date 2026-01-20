import starmaskLogo from '@/assets/img/starmask.svg'
import { normalizeEip1193Error } from '@/lib/format'
import { connectStarMask, getStarMaskProvider } from '@/lib/starcoinProvider'
import { cn } from '@/lib/utils'
import { useGlobalStore } from '@/stores/globalStore'
import type { WalletInfo } from '@/types/domain'
import { useCallback, useEffect, useState } from 'react'

type StarMaskProps = {
  onDialogOk?: () => void
  onChange?: (walletInfo: WalletInfo) => void
  onError?: (error: Error) => void
  className?: string
}

export default function StarMask({ className, onError, onDialogOk, onChange }: StarMaskProps) {
  console.log('StarMask component rendered')
  const [connecting, setConnecting] = useState(false)
  const { currentCoin } = useGlobalStore()

  const handleClick = useCallback(async () => {
    if (connecting) return
    try {
      setConnecting(true)
      // Convert chainId from hex string to number
      const chainId = parseInt(currentCoin.network.chainId, 16)
      const info = await connectStarMask(chainId)
      if (!info) throw new Error('Failed to connect to StarMask')

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
    const provider = getStarMaskProvider()
    setHasInstalled(!!provider)
  }, [])

  if (!hasInstalled) {
    return (
      <a
        href="https://chromewebstore.google.com/detail/starmask/kmheclfnfmpacglnpegeohempmedhiaf"
        target="_blank"
        rel="noreferrer noopener"
        className={cn('flex items-center space-x-4 rounded-md border p-2 disabled:cursor-not-allowed disabled:opacity-60', className)}
      >
        <img width={34} height={34} src={starmaskLogo} alt="StarMask Logo" className="grayscale" />
        <span>StarMask</span>
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
    >
      <img width={34} height={34} src={starmaskLogo} alt="StarMask Logo" />
      <div>{connecting ? 'Connecting…' : 'StarMask'}</div>
    </button>
  )
}
