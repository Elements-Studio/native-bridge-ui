import metamaskLogo from '@/assets/img/metamask.svg'
import { normalizeEip1193Error } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EIP1193Provider } from '@/types/domain'
import { BrowserProvider, formatEther } from 'ethers'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

function getMetaMaskProviderFromWindow(): EIP1193Provider | null {
  const eth: any = (window as any)?.ethereum
  if (!eth) return null
  const providers: any[] = eth.providers || []
  const mm = providers.find(p => p && p.isMetaMask) || (eth.isMetaMask ? eth : null)
  return mm || null
}

async function discoverMetaMaskProvider(timeout = 1200): Promise<EIP1193Provider | null> {
  return new Promise(resolve => {
    let picked: any | null = null
    const handler = (event: any) => {
      const info = event?.detail?.info
      const provider = event?.detail?.provider
      if (!info || !provider) return
      if (info.rdns === 'io.metamask') picked = provider
    }
    window.addEventListener('eip6963:announceProvider', handler)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handler)
      resolve(picked)
    }, timeout)
  })
}

type MetaMaskConnectedPayload = {
  address: string
  chainId: number
  balance: string
  eip1193Provider: EIP1193Provider
}

type MetaMaskProps = {
  onDialogOk?: () => void
  onConnected?: (payload: MetaMaskConnectedPayload) => void
  onError?: (error: Error) => void
} & React.ComponentProps<'button'>

export default function MetaMask({ className, onConnected, onError, onDialogOk, ...props }: MetaMaskProps) {
  console.log('MetaMask component rendered')
  const [connecting, setConnecting] = useState(false)
  const providerRef = useRef<EIP1193Provider | null>(null)

  useEffect(() => {
    ;(async () => {
      const mm = (await discoverMetaMaskProvider()) || getMetaMaskProviderFromWindow()
      providerRef.current = mm
    })()
  }, [])

  const handleClick = useCallback(async () => {
    if (connecting) return
    try {
      setConnecting(true)

      const mm = providerRef.current || (await discoverMetaMaskProvider()) || getMetaMaskProviderFromWindow()
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

      onDialogOk?.()
    } catch (err) {
      onError?.(normalizeEip1193Error(err))
    } finally {
      setConnecting(false)
    }
  }, [connecting, onConnected, onError, onDialogOk])

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
