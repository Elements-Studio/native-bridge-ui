import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { estimateFees, type EstimateFeesResponse } from '@/services'
import { useGlobalStore } from '@/stores/globalStore'
import { useEffect, useMemo, useState } from 'react'
import CoinSelectorCard from './CoinSelectorCard'
import FromToCard from './FromToCard'
import './panel.styl'

export default function BridgeAssetPanel() {
  const { fromWalletType } = useGlobalStore()
  const [fees, setFees] = useState<EstimateFeesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const direction = useMemo(() => (fromWalletType === 'EVM' ? 'eth_to_starcoin' : 'starcoin_to_eth'), [fromWalletType])

  useEffect(() => {
    let cancelled = false
    const fetchFees = async () => {
      setLoading(true)
      setError(null)
      setFees(null)
      try {
        const res = await estimateFees(direction)
        if (!cancelled) setFees(res)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to estimate fees')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchFees()
    return () => {
      cancelled = true
    }
  }, [direction])

  const estimatedGas = useMemo(() => {
    if (loading) return <Spinner className="me-[0.2em]" />
    if (error) return <span className="text-red-300">--</span>
    if (!fees) return '-'
    return `≈ ${fees.combined_approve_and_claim_estimate}`
  }, [fees, loading, error])

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
            <div className="flex items-center text-sm font-normal">{estimatedGas} ETH</div>
          </div>
          <div className="flex justify-between px-2 text-[#abbdcc]">
            <div className="text-sm font-normal">You receive</div>
            <div className="text-sm font-normal">{fees?.claim_estimate} USDT</div>
          </div>
        </div>

        <Button className="bg-[#346bba] text-gray-100">Bridge assets</Button>
      </div>
    </div>
  )
}
