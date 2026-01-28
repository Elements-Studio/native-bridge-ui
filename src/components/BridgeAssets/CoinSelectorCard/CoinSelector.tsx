import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import useEvmTools from '@/hooks/useEvmTools'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { connectMetaMask } from '@/lib/evmProvider'
import { useGlobalStore } from '@/stores/globalStore'
import type { CoinItem } from '@/types/domain'
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export default function CoinSelector() {
  const [isPending, setIsPending] = useState(false)
  const { currentCoin, setCurrentCoin, mappings, fromWalletType, setEvmWalletInfo, setInputBalance } = useGlobalStore()
  const { contextHolder: evmContextHolder, getBalance: getEvmBalance } = useEvmTools()
  const { contextHolder: starcoinContextHolder, getBalance: getStarcoinBalance } = useStarcoinTools()

  const items = useMemo(() => {
    return Object.values(mappings)
      .filter((item): item is CoinItem => !!item)
      .filter(item => item.walletType === fromWalletType && item.name !== currentCoin.name)
  }, [mappings, fromWalletType, currentCoin.name])

  const switchCoin = useCallback(
    async (coin: CoinItem) => {
      setIsPending(true)
      try {
        if (coin.walletType === 'EVM') {
          await getEvmBalance(coin.network.chainId, coin.ca)
          const info = await connectMetaMask()
          setEvmWalletInfo(info)
        } else {
          await getStarcoinBalance(coin.network.chainId, coin.ca)
        }
        setCurrentCoin(coin)
        setInputBalance('')
      } finally {
        setIsPending(false)
      }
    },
    [getEvmBalance, getStarcoinBalance, setCurrentCoin, setEvmWalletInfo, setInputBalance],
  )

  if (!items.length) {
    return (
      <div className="flex items-center gap-2 rounded-full py-2">
        {isPending ? <Spinner /> : <img src={currentCoin.icon} alt={currentCoin.name} width={24} height={24} />}

        {currentCoin.name}
      </div>
    )
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isPending}>
          <button className="flex cursor-pointer items-center gap-2 py-2 pr-3">
            {isPending ? <Spinner /> : <img src={currentCoin.icon} alt={currentCoin.name} width={24} height={24} />}
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
      {evmContextHolder}
      {starcoinContextHolder}
    </>
  )
}
