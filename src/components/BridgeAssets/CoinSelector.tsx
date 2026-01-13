import ethIcon from '@/assets/img/eth.svg'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useGlobalStore } from '@/stores/globalStore'
import { ChevronDown } from 'lucide-react'
import './panel.styl'

export default () => {
  const { evmWalletInfo } = useGlobalStore()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2">
          <img src={ethIcon} alt="ETH" width={24} height={24} />
          ETH {evmWalletInfo?.address}
          <ChevronDown size={20} color="#ccc" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-46.5">
        <DropdownMenuItem>
          <DropdownMenuShortcut>22222</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
