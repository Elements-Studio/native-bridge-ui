import starcoinIcon from '@/assets/img/starcoin.svg'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { formatAddress } from '@/lib/format'
import { useGlobalStore } from '@/stores/globalStore'
import { ArrowUpRight, ChevronDown, Copy, CopyCheck, Unlink } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Spinner } from '../ui/spinner'

export default function ConnectBtn() {
  const [isPending, setIsPending] = useState(false)
  const { contextHolder, openConnectDialog, disconnect } = useStarcoinTools()

  const { starcoinWalletInfo } = useGlobalStore()

  const Icon = useMemo(() => {
    return <img alt="Connect" loading="lazy" width="24" height="24" className="h-6 w-6 rounded-full object-cover" src={starcoinIcon} />
  }, [])

  const [copied, setCopied] = useState(false)
  const copyAddress = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1000)
  }, [])

  const address = useMemo(() => {
    return starcoinWalletInfo?.address || ''
  }, [starcoinWalletInfo])
  const explorerUrl = useMemo(() => {
    return `https://stcscan.io/main/transactions/detail/${address}`
  }, [address])

  if (!starcoinWalletInfo) {
    return (
      <>
        {contextHolder}
        <button
          className="ring-offset-background focus-visible:ring-ring border-border hover:text-accent-foreground flex h-10 cursor-pointer items-center justify-center gap-1 rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors duration-200 hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          onClick={openConnectDialog}
        >
          <div className="flex items-center gap-2">
            {Icon}
            <div className="text-md font-medium wrap-break-word">Connect</div>
          </div>
        </button>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button className="ring-offset-background focus-visible:ring-ring border-border hover:text-accent-foreground flex h-10 cursor-pointer items-center justify-center gap-1 rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors duration-200 hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
          <div className="flex items-center gap-2">
            {/* { walletType === 'EVM' ? JSON.stringify(evmWalletInfo) : JSON.stringify(starcoinWalletInfo) } */}
            {isPending ? <Spinner /> : Icon}

            <div className="text-md font-medium wrap-break-word">{formatAddress(address)}</div>

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
          <button
            disabled={isPending}
            className="flex w-full cursor-pointer"
            onClick={async () => {
              setIsPending(true)
              await disconnect()
              setIsPending(false)
            }}
          >
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
