import ethIcon from '@/assets/img/eth.svg'
import starcoinIcon from '@/assets/img/starcoin.svg'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAddress, normalizeHash } from '@/lib/format'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTransactionsDetailStore } from './store'

export default function ClaimCard() {
  const direction = useTransactionsDetailStore(state => state.direction)
  const transferData = useTransactionsDetailStore(state => state.transferData)
  const claimData = useMemo(() => transferData?.procedure?.claim, [transferData?.procedure?.claim])

  return (
    <div className="bg-secondary/50 grid h-full content-start overflow-hidden rounded-xl">
      <div className="bg-accent-foreground/10 flex items-center justify-between gap-x-3 p-5">
        <h3 className="text-primary-foreground text-lg font-bold wrap-break-word">
          {direction === 'eth_to_starcoin' ? 'Starcoin' : 'Ethereum'}
        </h3>
        <img width={32} height={32} src={direction === 'eth_to_starcoin' ? starcoinIcon : ethIcon} />
      </div>
      {claimData && (
        <div className="grid gap-3 p-5">
          {claimData.txn_hash ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Txn Hash</div>
              <Tooltip>
                <TooltipContent>{normalizeHash(claimData.txn_hash)}</TooltipContent>
                <TooltipTrigger>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {formatAddress(claimData.txn_hash)}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </div>
          ) : null}
          {claimData.block_height != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Block Height</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{claimData.block_height}</div>
            </div>
          ) : null}
          {claimData.timestamp_ms != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Timestamp</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                {new Date(claimData.timestamp_ms).toLocaleString()}
              </div>
            </div>
          ) : null}
          {claimData.claimer_address ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Claimer Address</div>
              <Tooltip>
                <TooltipContent>{claimData.claimer_address}</TooltipContent>
                <TooltipTrigger>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {formatAddress(claimData.claimer_address)}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </div>
          ) : null}
          {claimData.gas_usage != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Gas Usage</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{claimData.gas_usage}</div>
            </div>
          ) : null}
          {claimData.data_source ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Data Source</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{claimData.data_source}</div>
            </div>
          ) : null}
          {claimData.is_finalized != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Finalized</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                {claimData.is_finalized ? 'Yes' : 'No'}
              </div>
            </div>
          ) : null}

          {claimData.txn_hash && (
            <div className="mt-4 flex flex-row items-center justify-around">
              <a
                className="font-inter text-accent-foreground hover:text-accent-foreground/80 flex items-center gap-1 text-lg font-semibold uppercase transition-colors duration-200"
                href={
                  direction === 'eth_to_starcoin'
                    ? `https://stcscan.io/main/transactions/detail/${normalizeHash(claimData.txn_hash)}`
                    : `https://etherscan.io/tx/${normalizeHash(claimData.txn_hash)}`
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
