import ethIcon from '@/assets/img/eth.svg'
import starcoinIcon from '@/assets/img/starcoin.svg'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAddress, normalizeHash } from '@/lib/format'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTransactionsDetailStore } from './store'

export default function DepositCard() {
  const direction = useTransactionsDetailStore(state => state.direction)
  const transferData = useTransactionsDetailStore(state => state.transferData)
  const depositData = useMemo(() => transferData?.procedure?.deposit, [transferData?.procedure?.deposit])

  return (
    <div className="bg-secondary/50 grid h-full content-start overflow-hidden rounded-xl">
      <div className="bg-accent-foreground/10 flex items-center justify-between gap-x-3 p-5">
        <h3 className="text-primary-foreground text-lg font-bold wrap-break-word">
          {direction === 'eth_to_starcoin' ? 'Ethereum' : 'Starcoin'}
        </h3>
        <img width={32} height={32} src={direction === 'eth_to_starcoin' ? ethIcon : starcoinIcon} />
      </div>
      {depositData && (
        <div className="grid gap-3 p-5">
          {depositData.txn_hash ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Txn Hash</div>
              <Tooltip>
                <TooltipContent>{normalizeHash(depositData.txn_hash)}</TooltipContent>
                <TooltipTrigger>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {formatAddress(depositData.txn_hash)}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </div>
          ) : null}
          {depositData.block_height != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Block Height</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{depositData.block_height}</div>
            </div>
          ) : null}
          {depositData.timestamp_ms != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Timestamp</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                {new Date(depositData.timestamp_ms).toLocaleString()}
              </div>
            </div>
          ) : null}
          {depositData.sender_address ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Sender Address</div>
              <Tooltip>
                <TooltipContent>{depositData.sender_address}</TooltipContent>
                <TooltipTrigger>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {formatAddress(depositData.sender_address)}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </div>
          ) : null}
          {depositData.recipient_address ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Recipient Address</div>
              <Tooltip>
                <TooltipContent>{depositData.recipient_address}</TooltipContent>
                <TooltipTrigger>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {formatAddress(depositData.recipient_address)}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </div>
          ) : null}
          {depositData.token_id != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Token ID</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{depositData.token_id}</div>
            </div>
          ) : null}
          {depositData.amount != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Amount</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{depositData.amount}</div>
            </div>
          ) : null}
          {depositData.is_finalized != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">Finalized</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                {depositData.is_finalized ? 'Yes' : 'No'}
              </div>
            </div>
          ) : null}

          {depositData.txn_hash && (
            <div className="mt-4 flex flex-row items-center justify-around">
              <a
                className="font-inter text-accent-foreground hover:text-accent-foreground/80 flex items-center gap-1 text-lg font-semibold uppercase transition-colors duration-200"
                href={
                  direction === 'eth_to_starcoin'
                    ? `https://etherscan.io/tx/${normalizeHash(depositData.txn_hash)}`
                    : `https://stcscan.io/main/transactions/detail/${normalizeHash(depositData.txn_hash)}`
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
