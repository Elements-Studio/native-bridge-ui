import type { WalletType } from '@/types/domain'
import { ArrowRight, ArrowRightLeft } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export default () => {
  const [from, setFrom] = useState<WalletType>('EVM')
  const toggleCard = useCallback(() => {
    setFrom(prev => (prev === 'EVM' ? 'STARCOIN' : 'EVM'))
  }, [])
  const EvmCard = useMemo(() => {
    return (
      <div key="EvmCard" className="flex h-32.5 flex-col gap-4 space-y-4 bg-[#c0e6ff] px-6 py-6 text-black/90">
        <div className="relative flex w-full flex-1 items-center justify-between">
          <div className="text-sm leading-4 font-medium tracking-[0.6px]">{from === 'EVM' ? 'FROM' : 'TO'} ETHEREUM</div>
        </div>
        <button
          className="ring-offset-background focus-visible:ring-ring flex w-full items-center justify-between space-y-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          type="button"
        >
          <div className="text-2xl font-medium">Connect wallet</div>

          <ArrowRight />
        </button>
      </div>
    )
  }, [from])

  const StarcoinCard = useMemo(() => {
    return (
      <div key="StarcoinCard" className="flex h-32.5 flex-col space-y-4 bg-black/60 px-6 py-6">
        <div className="relative flex w-full flex-1 items-center justify-between">
          <div className="text-sm leading-4 font-medium tracking-[0.6px] text-zinc-200">{from === 'EVM' ? 'TO' : 'FROM'} STARCOIN</div>
          <button
            className="ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-2 py-1 text-sm leading-none font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            type="button"
          >
            <div className="rounded-2xl bg-gray-500 px-4 py-1 font-medium">Enter manually</div>
          </button>
        </div>
        <button
          className="ring-offset-background focus-visible:ring-ring flex w-full items-center justify-between space-y-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          type="button"
        >
          <div className="text-2xl font-medium">Connect wallet</div>

          <ArrowRight />
        </button>
      </div>
    )
  }, [from])
  return (
    <div className="relative m-4 overflow-hidden rounded-4xl">
      {from === 'EVM' ? [EvmCard, StarcoinCard] : [StarcoinCard, EvmCard]}

      <button
        onClick={toggleCard}
        className="ring-offset-background focus-visible:ring-ring text-primary-foreground absolute bottom-1/2 left-1/2 inline-flex h-10 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        <ArrowRightLeft />
      </button>
    </div>
  )
}
