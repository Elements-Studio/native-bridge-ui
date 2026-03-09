import ethIcon from '@/assets/img/eth.svg'
import starcoinIcon from '@/assets/img/starcoin.svg'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAddress, normalizeHash } from '@/lib/format'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../ui/spinner'
import { useTransactionsDetailStore } from './store'

export default function DepositCard() {
  const { t } = useTranslation()
  const direction = useTransactionsDetailStore(state => state.direction)
  const transferData = useTransactionsDetailStore(state => state.transferData)
  const depositData = useMemo(() => transferData?.procedure?.deposit, [transferData?.procedure?.deposit])

  return (
    <div className="bg-secondary/50 grid h-full min-h-75 content-start overflow-hidden rounded-xl">
      <div className="bg-accent-foreground/10 flex items-center justify-between gap-x-3 p-5">
        <h3 className="text-primary-foreground text-lg font-bold wrap-break-word">
          {direction === 'eth_to_starcoin' ? 'Ethereum' : 'Starcoin'}
        </h3>
        <img width={32} height={32} src={direction === 'eth_to_starcoin' ? ethIcon : starcoinIcon} />
      </div>
      {depositData ? (
        <div className="grid gap-3 p-5">
          {depositData.txn_hash ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.txnHash')}</div>
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
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.blockHeight')}</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{depositData.block_height}</div>
            </div>
          ) : null}
          {depositData.timestamp_ms != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.timestamp')}</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                {new Date(depositData.timestamp_ms).toLocaleString()}
              </div>
            </div>
          ) : null}
          {depositData.sender_address ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.senderAddress')}</div>
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
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.recipientAddress')}</div>
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
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.tokenId')}</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{depositData.token_id}</div>
            </div>
          ) : null}
          {depositData.amount != null ? (
            <div className="flex items-center justify-between gap-x-3">
              <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.amount')}</div>
              <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">{depositData.amount}</div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-x-3">
            <div className="text-md text-secondary-foreground font-medium wrap-break-word">{t('transaction.finalized')}</div>
            <div className={`font-inter text-md font-medium wrap-break-word ${depositData.is_finalized ? 'text-green-400' : 'text-yellow-400'}`}>
              {depositData.is_finalized ? t('status.indexerFinalized') : t('status.indexerFoundWaitingFinalized')}
            </div>
          </div>

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
                {t('transaction.viewOnExplorer')}
                <ChevronRight />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-50 flex-col items-center justify-center gap-3 p-5">
          <Spinner />
          <div className="text-sm text-yellow-400">{t('status.indexerNotFound')}</div>
        </div>
      )}
    </div>
  )
}
