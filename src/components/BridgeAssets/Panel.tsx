import { Button } from '@/components/ui/button'
import CoinSelectorCard from './CoinSelectorCard'
import FromToCard from './FromToCard'
import './panel.styl'

export default function BridgeAssetPanel() {
  return (
    <div className="i-panel relative min-h-149 max-w-117.5 min-w-100 rounded-3xl bg-[rgba(44,41,88,0.8)]">
      {/* card1 */}
      <CoinSelectorCard />

      {/* Card2 */}
      <FromToCard />

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
