import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { connectMetaMask } from '@/lib/evmProvider'
import { useGlobalStore, type CoinItem } from '@/stores/globalStore'
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import useUtils from './utils.hook'

export default () => {
  const { currentCoin, setCurrentCoin, mappings, fromWalletType, setEvmWalletInfo, setInputBalance } = useGlobalStore()
  const { contextHolder, getBalance } = useUtils()

  const items = useMemo(() => {
    return Object.values(mappings).filter(item => item.walletType === fromWalletType && item.name !== currentCoin.name)
  }, [mappings, fromWalletType, currentCoin.name])

  const switchCoin = useCallback(async (coin: CoinItem) => {
    await getBalance(coin.network.chainId)
    if (coin.walletType === 'EVM') {
      const info = await connectMetaMask()
      setEvmWalletInfo(info)
    }
    setCurrentCoin(coin)
    setInputBalance('')
  }, [])

  if (!items.length) {
    return (
      <div className="ms-3 flex items-center gap-2 rounded-full px-3 py-2">
        <img src={currentCoin.icon} alt={currentCoin.name} width={24} height={24} />
        {currentCoin.name}
      </div>
    )
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="ms-3 flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 hover:bg-white/10">
            <img src={currentCoin.icon} alt={currentCoin.name} width={24} height={24} />
            {currentCoin.name}
            <ChevronDown size={20} color="#ccc" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {items.map(coin => {
            return (
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2"
                key={coin.name + coin.walletType}
                onClick={() => switchCoin(coin)}
              >
                <img src={coin.icon} alt={coin.name} width={24} height={24} />
                <DropdownMenuShortcut>{coin.name}</DropdownMenuShortcut>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {contextHolder}
    </>
  )
}
