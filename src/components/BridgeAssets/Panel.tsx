import ethIcon from '@/assets/img/eth.svg'
import { Button } from '@/components/ui/button'
import { ArrowRight, ArrowRightLeft, ChevronDown } from 'lucide-react'
import './panel.styl'

export default () => {
  return (
    <div className="i-panel relative min-h-149 max-w-117.5 min-w-100 rounded-3xl bg-[rgba(44,41,88,0.8)]">
      {/* card1 */}
      <div className="m-4 flex flex-col justify-between gap-4 rounded-2xl border border-gray-500 p-6">
        <div className="flex justify-between">
          {/* Selector */}
          <button className="flex items-center gap-2">
            <img src={ethIcon} alt="ETH" width={24} height={24} />
            ETH
            <ChevronDown size={20} color="#ccc" />
          </button>
          {/* max */}
          <button
            className="ring-offset-background focus-visible:ring-ring inline-flex h-10 cursor-pointer items-center justify-center rounded-full border px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            type="button"
          >
            Max
          </button>
        </div>
        {/* input */}
        <input
          className="h-10 w-full [appearance:textfield] bg-transparent font-mono text-4xl ring-0 outline-none focus-visible:ring-0 focus-visible:outline-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
          placeholder="0.00"
          type="number"
        />
      </div>

      {/* Card2 */}
      <div className="relative m-4">
        {/* top */}
        <div className="flex h-32.5 flex-col gap-4 space-y-4 rounded-t-4xl rounded-b-none bg-[#c0e6ff] px-6 py-6 text-black/90">
          <div className="relative flex w-full flex-1 items-center justify-between">
            <div className="text-sm leading-4 font-medium tracking-[0.6px]">FROM ETHEREUM</div>
          </div>
          <button
            className="ring-offset-background focus-visible:ring-ring flex w-full items-center justify-between space-y-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            type="button"
          >
            <div className="text-2xl font-medium">Connect wallet</div>

            <ArrowRight />
          </button>
        </div>
        {/* bottom */}
        <div className="flex h-32.5 flex-col space-y-4 rounded-t-none rounded-b-4xl bg-black/60 px-6 py-6">
          <div className="relative flex w-full flex-1 items-center justify-between">
            <div className="text-sm leading-4 font-medium tracking-[0.6px] text-zinc-200">TO ETHEREUM</div>
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

        <button className="ring-offset-background focus-visible:ring-ring text-primary-foreground absolute bottom-1/2 left-1/2 inline-flex h-10 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
          <ArrowRightLeft />
        </button>
      </div>

      {/* Actions */}
      <div className="m-4 flex flex-col gap-6 rounded-b-4xl">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between px-2 text-[#abbdcc]">
            <div className="text-sm font-normal">Estimated Gas</div>
            <div className="text-sm font-normal">- ETH</div>
          </div>
          <div className="flex justify-between px-2 text-[#abbdcc]">
            <div className="text-sm font-normal">You receive</div>
            <div className="text-sm font-normal">10 ETH</div>
          </div>
        </div>

        <Button className="bg-[#346bba] text-gray-100">Bridge assets</Button>
      </div>
    </div>
  )
}
