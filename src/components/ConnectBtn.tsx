import evmIcon from '@/assets/img/eth.svg'
import starcoinIcon from '@/assets/img/starcoin.svg'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import WalletDialog from '@/components/WalletDialog'
import { getAllProviders, getMetaMask } from '@/lib/evmProvider'
import { formatAddress } from '@/lib/format'
import storage from '@/lib/storage'
import { asyncMap } from '@/lib/utils'
import { useGlobalStore } from '@/stores/globalStore'
import { ArrowUpRight, ChevronDown, Copy, CopyCheck, Unlink } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

export async function tryReconnectEvm() {
  const mm = await getMetaMask()
  if (!mm) return null
  const accounts: string[] = await mm.request({ method: 'eth_accounts' })
  if (accounts.length > 0) {
    return accounts[0]
  }

  return null
}

interface IProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  walletType?: 'EVM' | 'STARCOIN'
}
export default function ConnectBtn(props: IProps) {
  const { walletType = 'EVM' } = props
  const { evmWalletInfo, setEvmWalletInfo, starcoinWalletInfo, setStarcoinWalletInfo } = useGlobalStore()
  const [rehydratedAddress, setRehydratedAddress] = useState('')

  useEffect(() => {
    ;(async () => {
      if (walletType !== 'EVM') return

      const localAddress = storage.getItem('evm_rehydrated_address')
      if (!localAddress) return
      setRehydratedAddress(localAddress || '')
      setIsConnected(true)
      const address = await tryReconnectEvm()
      if (address) {
        setRehydratedAddress(address)
        setIsConnected(true)
        storage.setItem('evm_rehydrated_address', address)
      }
    })()
  }, [walletType])

  const [isConnected, setIsConnected] = useState(false)
  const Icon = useMemo(() => {
    const src = walletType === 'EVM' ? evmIcon : starcoinIcon
    return <img alt="Connect" loading="lazy" width="24" height="24" className="h-6 w-6 rounded-full object-cover" src={src} />
  }, [walletType])

  const [copied, setCopied] = useState(false)
  const copyAddress = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1000)
  }, [])

  const address = useMemo(() => {
    if (walletType === 'EVM') {
      return evmWalletInfo?.address || rehydratedAddress || ''
    } else {
      return starcoinWalletInfo?.address || ''
    }
  }, [walletType, evmWalletInfo, starcoinWalletInfo, rehydratedAddress])
  const explorerUrl = useMemo(() => {
    if (walletType === 'EVM') {
      return `https://etherscan.io/address/${address}`
    } else {
      return `https://stcscan.io/main/transactions/detail/${address}`
    }
  }, [walletType, address])
  const disconnect = useCallback(async () => {
    if (walletType === 'EVM') {
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
      setRehydratedAddress('')
      storage.removeItem('evm_rehydrated_address')
    } else {
      setStarcoinWalletInfo(null)
    }
    setIsConnected(false)
  }, [walletType, setEvmWalletInfo, setStarcoinWalletInfo])

  const [isOpen, setIsOpen] = useState(false)
  if (!isConnected) {
    return (
      <>
        <WalletDialog
          open={isOpen}
          onCancel={() => {
            setIsOpen(false)
          }}
          onOk={data => {
            if (walletType === 'EVM') {
              setEvmWalletInfo(data.walletInfo)
              storage.setItem('evm_rehydrated_address', data.walletInfo?.address || '')
            } else {
              setStarcoinWalletInfo(data.walletInfo)
            }
            setIsConnected(true)
            setIsOpen(false)
          }}
        />

        <button
          className="ring-offset-background focus-visible:ring-ring border-stroke-primary hover:bg-background-tertiaryHover text-content-primary flex h-10 items-center justify-center gap-1 rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          onClick={() => setIsOpen(true)}
        >
          <div className="flex items-center gap-2">
            {Icon}
            <div className="text-md text-content-primary font-medium wrap-break-word">Connect</div>
          </div>
        </button>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ring-offset-background focus-visible:ring-ring border-stroke-primary hover:bg-background-tertiaryHover text-content-primary flex h-10 items-center justify-center gap-1 rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
          <div className="flex items-center gap-2">
            {/* { walletType === 'EVM' ? JSON.stringify(evmWalletInfo) : JSON.stringify(starcoinWalletInfo) } */}
            {Icon}

            <div className="text-md text-content-primary font-medium wrap-break-word">{formatAddress(address)}</div>

            <ChevronDown width={18} height={18} />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-46.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem className="cursor-pointer" onClick={() => copyAddress(address)}>
              Copy
              <DropdownMenuShortcut>{copied ? <CopyCheck color="green" /> : <Copy />}</DropdownMenuShortcut>
            </DropdownMenuItem>
          </TooltipTrigger>
          <TooltipContent>{address}</TooltipContent>
        </Tooltip>
        <DropdownMenuItem className="cursor-pointer">
          <a href={explorerUrl} className="flex w-full cursor-pointer" target="_blank" rel="noopener noreferrer">
            Explorer
            <DropdownMenuShortcut>
              <ArrowUpRight />
            </DropdownMenuShortcut>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          <button className="flex w-full cursor-pointer" onClick={disconnect}>
            Disconnect
            <DropdownMenuShortcut>
              <Unlink />
            </DropdownMenuShortcut>
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
