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
import { useWalletDialogStore } from '@/stores/walletDialogStore'
import { ArrowUpRight, ChevronDown, Copy, CopyCheck, Unlink } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export interface IProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  walletType?: 'EVM' | 'STARCOIN'
}
export default function ConnectBtn(props: IProps) {
  const { walletType = 'EVM' } = props

  const { openDialog } = useWalletDialogStore()
  const selectEvmWallet = useCallback(async () => {
    const result = await openDialog({
      title: 'Select EVM wallet',
    })
    setIsConnected(true)
    console.log('Selected EVM wallet:', result)
  }, [openDialog])

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
            console.log(8888, data)
            setIsOpen(false)
          }}
        />

        <button
          className="ring-offset-background focus-visible:ring-ring border-stroke-primary hover:bg-background-tertiaryHover text-content-primary flex h-10 items-center justify-center gap-1 rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          onClick={() => setIsOpen(true)}
        >
          <div className="flex items-center gap-2">
            {Icon}
            <div className="text-md text-content-primary font-medium break-words">Connect</div>
          </div>
        </button>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ring-offset-background focus-visible:ring-ring border-stroke-primary hover:bg-background-tertiaryHover text-content-primary flex h-10 items-center justify-center gap-1 rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          onClick={selectEvmWallet}
        >
          <div className="flex items-center gap-2">
            {Icon}

            <div className="text-md text-content-primary font-medium break-words">0x403F…734c</div>

            <ChevronDown width={18} height={18} />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[186px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem className="cursor-pointer" onClick={() => copyAddress('0x403F734c734c734c734c734c734c734c734c734c734c')}>
              Copy
              <DropdownMenuShortcut>{copied ? <CopyCheck /> : <Copy />}</DropdownMenuShortcut>
            </DropdownMenuItem>
          </TooltipTrigger>
          <TooltipContent>0x403F734c734c734c734c734c734c734c734c734c734c</TooltipContent>
        </Tooltip>
        <DropdownMenuItem className="cursor-pointer">
          Explorer
          <DropdownMenuShortcut>
            <ArrowUpRight />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          Disconnect
          <DropdownMenuShortcut>
            <Unlink />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
