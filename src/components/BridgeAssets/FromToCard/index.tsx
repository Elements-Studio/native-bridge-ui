import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import useEvmTools from '@/hooks/useEvmTools'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { formatAddress } from '@/lib/format'
import { useGlobalStore } from '@/stores/globalStore'
import type { WalletType } from '@/types/domain'
import { ArrowRight, ArrowRightLeft, Unlink } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export default function FromToCard() {
  const [iEvmPending, setIsEvmPending] = useState(false)
  const [iStarcoinPending, setIsStarcoinPending] = useState(false)

  const { contextHolder: evmContextHolder, openConnectDialog: openEvmConnectDialog, disconnect: disconnectEVM } = useEvmTools()
  const {
    contextHolder: starcoinContextHolder,
    openConnectDialog: openStarcoinConnectDialog,
    disconnect: disconnectStarcoin,
  } = useStarcoinTools()
  const { evmWalletInfo, starcoinWalletInfo, fromWalletType, toWalletType, setFromWalletType, setToWalletType } = useGlobalStore()
  const [from, setFrom] = useState<WalletType>(fromWalletType)
  const toggleCard = useCallback(() => {
    setFrom(prev => {
      const next = prev === 'EVM' ? 'STARCOIN' : 'EVM'
      setFromWalletType(next)
      setToWalletType(prev)
      return next
    })
  }, [setFromWalletType, setToWalletType])
  const EvmCard = useMemo(() => {
    return (
      <div key="EvmCard" className="bg-accent/80 flex flex-col gap-4 space-y-4 p-6 text-black/90 backdrop-blur-xs">
        <div className="relative flex w-full flex-1 items-center justify-between">
          <div className="text-sm leading-4 font-medium tracking-[0.6px]">{from === 'EVM' ? 'FROM' : 'TO'} ETHEREUM</div>
        </div>
        {evmWalletInfo?.address ? (
          <div className="ring-offset-background focus-visible:ring-ring flex w-full items-center justify-between rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-2xl font-medium">{formatAddress(evmWalletInfo.address)}</span>
              </TooltipTrigger>
              <TooltipContent>{evmWalletInfo.address}</TooltipContent>
            </Tooltip>
            <button
              disabled={iEvmPending}
              onClick={async () => {
                setIsEvmPending(true)
                await disconnectEVM()
                setIsEvmPending(false)
              }}
              className="cursor-pointer hover:text-red-500"
            >
              {iEvmPending ? <Spinner /> : <Unlink />}
            </button>
          </div>
        ) : (
          <button
            onClick={openEvmConnectDialog}
            className="ring-offset-background focus-visible:ring-ring hover:text-accent-foreground flex w-full cursor-pointer items-center justify-between rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="text-2xl font-medium">Connect wallet</span>
            <ArrowRight />
          </button>
        )}
      </div>
    )
  }, [from, evmWalletInfo, openEvmConnectDialog, disconnectEVM, iEvmPending])

  const StarcoinCard = useMemo(() => {
    return (
      <div key="StarcoinCard" className="bg-secondary/80 flex flex-col gap-4 space-y-4 p-6 backdrop-blur-xs">
        <div className="relative flex w-full flex-1 items-center justify-between">
          <div className="text-sm leading-4 font-medium tracking-[0.6px] text-zinc-200">{from === 'EVM' ? 'TO' : 'FROM'} STARCOIN</div>
          {/* <button
            className="ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-2 py-1 text-sm leading-none font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            type="button"
          >
            <div className="rounded-2xl bg-gray-500 px-4 py-1 font-medium">Enter manually</div>
          </button> */}
        </div>

        {starcoinWalletInfo?.address ? (
          <div className="ring-offset-background focus-visible:ring-ring flex w-full items-center justify-between rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-2xl font-medium">{formatAddress(starcoinWalletInfo.address)}</span>
              </TooltipTrigger>
              <TooltipContent>{starcoinWalletInfo.address}</TooltipContent>
            </Tooltip>

            <button
              disabled={iStarcoinPending}
              onClick={async () => {
                setIsStarcoinPending(true)
                await disconnectStarcoin()
                setIsStarcoinPending(false)
              }}
              className="cursor-pointer hover:text-red-500"
            >
              {iStarcoinPending ? <Spinner /> : <Unlink />}
            </button>
          </div>
        ) : (
          <button
            onClick={openStarcoinConnectDialog}
            className="ring-offset-background focus-visible:ring-ring hover:text-accent-foreground flex w-full cursor-pointer items-center justify-between rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="text-2xl font-medium">Connect wallet</span>
            <ArrowRight />
          </button>
        )}
      </div>
    )
  }, [from, starcoinWalletInfo, openStarcoinConnectDialog, disconnectStarcoin, iStarcoinPending])

  return (
    <>
      fromWalletType: {fromWalletType}
      <br />
      toWalletType: {toWalletType}
      {evmContextHolder}
      {starcoinContextHolder}
      <div className="relative overflow-hidden rounded-4xl">
        {from === 'EVM' ? [EvmCard, StarcoinCard] : [StarcoinCard, EvmCard]}

        <button
          onClick={toggleCard}
          className="ring-offset-background focus-visible:ring-ring text-accent-foreground absolute bottom-1/2 left-1/2 inline-flex h-10 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowRightLeft />
        </button>
      </div>
    </>
  )
}
