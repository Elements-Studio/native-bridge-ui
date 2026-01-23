import walletIcon from '@/assets/img/wallet.svg'
import { Spinner } from '@/components/ui/spinner'
import useEvmTools from '@/hooks/useEvmTools'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { toFixedWithoutRounding } from '@/lib/format'
import { useGlobalStore } from '@/stores/globalStore'
import { useCallback, useEffect, useState } from 'react'
import CoinSelector from './CoinSelector'

export default function CoinSelectorCard() {
  const [isPending, setIsPending] = useState(false)
  const { currentCoin, evmWalletInfo, starcoinWalletInfo, inputBalance, setInputBalance } = useGlobalStore()
  const { getBalance: getEvmBalance, contextHolder: evmContextHolder } = useEvmTools()
  const { getBalance: getStarcoinBalance, contextHolder: starcoinContextHolder } = useStarcoinTools()
  const [totalBalance, setTotalBalance] = useState<string>('')

  useEffect(() => {
    if (!currentCoin) return

    if (currentCoin.walletType === 'EVM' && !evmWalletInfo) return

    if (currentCoin.walletType === 'STARCOIN' && !starcoinWalletInfo) return

    const fetchBalance = async () => {
      setTotalBalance('')
      setIsPending(true)
      console.info('[CoinSelectorCard] fetchBalance', { currentCoin })
      const result =
        currentCoin.walletType === 'STARCOIN'
          ? await getStarcoinBalance(currentCoin.network.chainId, currentCoin.ca)
          : await getEvmBalance(currentCoin.network.chainId, currentCoin.ca)
      const balance = result?.balance
      if (balance) {
        console.log(11111, balance)
        setTotalBalance(balance)
      } else {
        setTotalBalance('')
      }
      setIsPending(false)
    }
    fetchBalance()
  }, [evmWalletInfo, starcoinWalletInfo, currentCoin, getEvmBalance, getStarcoinBalance])

  const setMax = useCallback(async () => {
    console.info('[CoinSelectorCard] setMax', { currentCoin })
    const result =
      currentCoin.walletType === 'STARCOIN'
        ? await getStarcoinBalance(currentCoin.network.chainId, currentCoin.ca)
        : await getEvmBalance(currentCoin.network.chainId, currentCoin.ca)
    const balance = result?.balance
    if (balance) {
      setInputBalance(Number(balance).toFixed(6).toString())
    }
  }, [currentCoin, getEvmBalance, getStarcoinBalance, setInputBalance])

  return (
    <div className="m-4 flex flex-col justify-between gap-4 rounded-2xl border border-gray-500 py-6">
      <div className="flex justify-between">
        {/* Selector */}
        <CoinSelector />

        {/* max */}
        <button
          className="ring-offset-background focus-visible:ring-ring me-6 inline-flex h-10 cursor-pointer items-center justify-center rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          type="button"
          onClick={setMax}
        >
          Max
        </button>
      </div>
      {/* input */}
      <input
        name="inputBalance"
        className="mx-6 h-10 [appearance:textfield] bg-transparent font-mono text-4xl ring-0 outline-none focus-visible:ring-0 focus-visible:outline-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
        placeholder="0.00"
        value={inputBalance}
        onChange={e => setInputBalance(e.target.value)}
        type="number"
      />

      {/* balance */}
      {
        <div className="ms-6 flex w-full items-center gap-2">
          <img src={walletIcon} width={12} height={12} />

          <div className="flex font-mono text-sm font-normal text-[#9f9aae] uppercase">
            <span className="wrap-break-words me-[0.5em] max-w-70 truncate">
              {isPending ? <Spinner /> : toFixedWithoutRounding(totalBalance, 3)}
            </span>
            {currentCoin.name}
          </div>
        </div>
      }

      {evmContextHolder}
      {starcoinContextHolder}
      {/* {JSON.stringify(evmWalletInfo)} {JSON.stringify(starcoinWalletInfo)} */}
    </div>
  )
}
