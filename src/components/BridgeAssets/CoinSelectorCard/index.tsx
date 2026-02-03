import walletIcon from '@/assets/img/wallet.svg'
import { Spinner } from '@/components/ui/spinner'
import useEvmTools from '@/hooks/useEvmTools'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { getMetaMask } from '@/lib/evmProvider'
import { toFixedWithoutRounding } from '@/lib/format'
import { useGlobalStore } from '@/stores/globalStore'
import { useCallback, useEffect, useState } from 'react'
import CoinSelector from './CoinSelector'

export default function CoinSelectorCard() {
  const [isPending, setIsPending] = useState(false)
  const currentCoin = useGlobalStore(state => state.currentCoin)
  const evmWalletInfo = useGlobalStore(state => state.evmWalletInfo)
  const starcoinWalletInfo = useGlobalStore(state => state.starcoinWalletInfo)
  const inputBalance = useGlobalStore(state => state.inputBalance)
  const setInputBalance = useGlobalStore(state => state.setInputBalance)

  const { getBalance: getEvmBalance, contextHolder: evmContextHolder, openConnectDialog: openEvmConnectDialog } = useEvmTools()
  const {
    getBalance: getStarcoinBalance,
    contextHolder: starcoinContextHolder,
    openConnectDialog: openStarcoinConnectDialog,
  } = useStarcoinTools()
  const [totalBalance, setTotalBalance] = useState<string>('')

  useEffect(() => {
    if (currentCoin?.walletType !== 'EVM') return
    if (!evmWalletInfo?.address) return
    if (evmWalletInfo.network.chainId === currentCoin.network.chainId) return

    const switchNetwork = async () => {
      try {
        const mm = await getMetaMask()
        if (!mm) return
        await mm.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: currentCoin.network.chainId }],
        })
      } catch (err) {
        console.error('Failed to switch EVM network', err)
      }
    }
    switchNetwork()
  }, [currentCoin, evmWalletInfo])

  useEffect(() => {
    if (!currentCoin) return

    if (currentCoin.walletType === 'EVM' && !evmWalletInfo) return

    if (currentCoin.walletType === 'STARCOIN' && !starcoinWalletInfo) return

    const fetchBalance = async () => {
      try {
        setTotalBalance('')
        setIsPending(true)
        console.info('[CoinSelectorCard] fetchBalance', { currentCoin })
        const result =
          currentCoin.walletType === 'STARCOIN'
            ? await getStarcoinBalance(currentCoin.network.chainId, currentCoin.ca)
            : await getEvmBalance(currentCoin.network.chainId, currentCoin.ca)

        const balance = result?.balance
        if (balance) {
          setTotalBalance(balance)
        } else {
          setTotalBalance('')
        }
      } catch (err) {
        console.error('Failed to fetch balance', err)
        setTotalBalance('')
      } finally {
        setIsPending(false)
      }
    }
    fetchBalance()
  }, [evmWalletInfo, starcoinWalletInfo, currentCoin, getEvmBalance, getStarcoinBalance])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (value === '') {
        setInputBalance('')
        return
      }

      if (value.includes('e') || value.includes('E')) {
        return
      }

      const [intPart, decPart] = value.split('.')
      if (intPart && intPart.replace('-', '').length > 18) {
        return
      }

      const numValue = Number(value)
      if (numValue < 0) {
        return
      }

      const maxDecimals = currentCoin?.decimals ?? 3
      if (decPart && decPart.length > maxDecimals) {
        return
      }
      setInputBalance(value)
    },
    [setInputBalance, currentCoin],
  )

  const handleInputBlur = useCallback(() => {
    if (!inputBalance) return
    const numValue = Number(inputBalance)
    const maxBalance = Number(totalBalance) || 0
    if (numValue > maxBalance) {
      setInputBalance(maxBalance.toFixed(currentCoin?.decimals ?? 3).toString())
    }
  }, [inputBalance, totalBalance, setInputBalance, currentCoin])

  const connectWallet = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (currentCoin.walletType === 'EVM') {
        if (!evmWalletInfo) {
          openEvmConnectDialog()
        }
      } else if (currentCoin.walletType === 'STARCOIN') {
        if (!starcoinWalletInfo) {
          openStarcoinConnectDialog()
        }
      }
    },
    [currentCoin, evmWalletInfo, starcoinWalletInfo, openEvmConnectDialog, openStarcoinConnectDialog],
  )

  const setMax = useCallback(async () => {
    console.info('[CoinSelectorCard] setMax', { currentCoin })
    const result =
      currentCoin.walletType === 'STARCOIN'
        ? await getStarcoinBalance(currentCoin.network.chainId, currentCoin.ca)
        : await getEvmBalance(currentCoin.network.chainId, currentCoin.ca)
    const balance = result?.balance
    if (balance) {
      setInputBalance((+balance).toFixed(currentCoin.decimals).toString())
    }
  }, [currentCoin, getEvmBalance, getStarcoinBalance, setInputBalance])

  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-500 p-6">
      <div className="flex justify-between">
        {/* Selector */}
        <CoinSelector />

        {/* max */}
        <button
          className="ring-offset-background focus-visible:ring-ring border-border hover:bg-secondary/10 hover:text-accent-foreground inline-flex h-10 cursor-pointer items-center justify-center rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          type="button"
          onClick={setMax}
        >
          Max
        </button>
      </div>
      {/* input */}
      <input
        name="inputBalance"
        className="h-10 w-full cursor-text [appearance:textfield] bg-transparent font-mono text-4xl ring-0 outline-none focus-visible:ring-0 focus-visible:outline-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
        placeholder="0.0"
        value={inputBalance}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onClick={connectWallet}
        type="text"
        inputMode="decimal"
      />

      {/* balance */}
      {
        <div className="flex w-full items-center gap-2">
          <img src={walletIcon} width={12} height={12} />

          <div className="flex font-mono text-sm font-normal text-[#9f9aae] uppercase">
            <span className="wrap-break-words me-[0.5em] max-w-70 truncate">
              {isPending ? <Spinner /> : toFixedWithoutRounding(totalBalance, 6)}
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
