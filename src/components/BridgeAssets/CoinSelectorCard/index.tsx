import walletIcon from '@/assets/img/wallet.svg'
import useEvmTools from '@/hooks/useEvmTools'
import { useGlobalStore } from '@/stores/globalStore'
import { useCallback, useEffect, useState } from 'react'
import CoinSelector from './CoinSelector'

export default function CoinSelectorCard() {
  const { currentCoin, evmWalletInfo, inputBalance, setInputBalance } = useGlobalStore()
  const { getBalance, contextHolder } = useEvmTools()
  const [totalBalance, setTotalBalance] = useState<string>('')

  useEffect(() => {
    if (!evmWalletInfo) return
    const fetchBalance = async () => {
      const result = await getBalance(currentCoin.network.chainId)
      const balance = result?.balance
      if (balance) {
        setTotalBalance(Number(balance).toFixed(6).toString())
      }
    }
    fetchBalance()
  }, [evmWalletInfo, currentCoin, getBalance])

  const setMax = useCallback(async () => {
    const result = await getBalance(currentCoin.network.chainId)
    const balance = result?.balance
    if (balance) {
      setInputBalance(Number(balance).toFixed(6).toString())
    }
  }, [currentCoin, getBalance, setInputBalance])

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
      {evmWalletInfo && (
        <div className="ms-6 flex w-full items-center gap-2">
          <img src={walletIcon} width={12} height={12} />

          <div className="flex font-mono text-sm font-normal text-[#9f9aae] uppercase">
            <span className="wrap-break-words me-[0.5em] max-w-70 truncate">{totalBalance ? totalBalance : '--'}</span>
            {currentCoin.name}
          </div>
        </div>
      )}

      {contextHolder}
      {/* {JSON.stringify(evmWalletInfo)} {JSON.stringify(starcoinWalletInfo)} */}
    </div>
  )
}
