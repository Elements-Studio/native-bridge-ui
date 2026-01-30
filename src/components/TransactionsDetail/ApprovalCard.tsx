import ethIcon from '@/assets/img/eth.svg'
import starcoinIcon from '@/assets/img/starcoin.svg'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAddress, normalizeHash } from '@/lib/format'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTransactionsDetailStore } from './store'

export default function ApprovalCard() {
  const direction = useTransactionsDetailStore(state => state.direction)
  const transferData = useTransactionsDetailStore(state => state.transferData)
  const approvalData = useMemo(() => transferData?.procedure?.approval, [transferData?.procedure?.approval])

  return (
    <div className="bg-secondary/50 grid h-full content-start overflow-hidden rounded-xl">
      <div className="bg-accent-foreground/10 flex items-center justify-between gap-x-3 p-5">
        <h3 className="text-primary-foreground text-lg font-bold wrap-break-word">
          {direction === 'eth_to_starcoin' ? 'Starcoin' : 'Ethereum'}
        </h3>
        <img width={32} height={32} src={direction === 'eth_to_starcoin' ? starcoinIcon : ethIcon} />
      </div>
      {approvalData && (
        <div className="grid gap-3 p-5">
          {approvalData.txn_hash ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Txn Hash</div>
              <Tooltip>
                <TooltipContent>{normalizeHash(approvalData.txn_hash)}</TooltipContent>
                <TooltipTrigger>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {formatAddress(approvalData.txn_hash)}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </div>
          ) : null}
          {approvalData.block_height != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Block Height</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{approvalData.block_height}</div>
            </div>
          ) : null}
          {approvalData.timestamp_ms != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Timestamp</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                {new Date(approvalData.timestamp_ms).toLocaleString()}
              </div>
            </div>
          ) : null}
          {approvalData.data_source ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Data Source</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{approvalData.data_source}</div>
            </div>
          ) : null}
          {approvalData.is_finalized != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Finalized</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                {approvalData.is_finalized ? 'Yes' : 'No'}
              </div>
            </div>
          ) : null}

          {approvalData.txn_hash && (
            <div className="mt-4 flex flex-row items-center justify-around">
              <a
                className="font-inter text-accent-foreground hover:text-accent-foreground/80 flex items-center gap-1 text-lg font-semibold uppercase transition-colors duration-200"
                href={
                  approvalData.data_source === 'STARCOIN'
                    ? `https://stcscan.io/main/transactions/detail/${normalizeHash(approvalData.txn_hash)}`
                    : `https://etherscan.io/tx/${normalizeHash(approvalData.txn_hash)}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Explorer
                <ChevronRight />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
