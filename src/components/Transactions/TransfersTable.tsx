import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAddress } from '@/lib/format'
import type { Pagination, TransferListItem } from '@/services/types'
import clsx from 'clsx'
import { Link } from 'react-router-dom'

interface TransfersTableProps {
  data: TransferListItem[]
  pagination: Pagination
  isLoading: boolean
  onPageChange: (page: number) => void
  direction: 'eth_to_starcoin' | 'starcoin_to_eth'
}

export function TransfersTable({ data, pagination, isLoading, onPageChange, direction }: TransfersTableProps) {
  const formatTimestamp = (ms: number) => {
    return new Date(ms).toLocaleString()
  }

  const buildTxLink = (item: TransferListItem) => {
    const txnHash = item.deposit?.txn_hash ?? ''
    return `/transactions/${txnHash}?direction=${direction}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deposited':
        return 'bg-blue-100 text-blue-800'
      case 'approved':
        return 'bg-yellow-100 text-yellow-800'
      case 'claimed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Transaction Hash</TableHead>
              <TableHead>Nonce</TableHead>
              <TableHead>From → To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sender Address</TableHead>
              <TableHead>Block Height</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Finalized</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                  {isLoading ? 'Loading...' : 'No transactions found'}
                </TableCell>
              </TableRow>
            ) : (
              data.map(item => (
                <TableRow key={`${item.source_chain_id}-${item.nonce}-${item.deposit?.sender_address}`}>
                  <TableCell className="font-mono text-sm">
                    <Link to={buildTxLink(item)} title={item.deposit?.txn_hash} className="text-blue-600 hover:underline">
                      {formatAddress(item.deposit?.txn_hash ?? '')}
                    </Link>
                  </TableCell>
                  <TableCell>{item.nonce}</TableCell>
                  <TableCell>
                    {item.source_chain_id} → {item.destination_chain_id}
                  </TableCell>
                  <TableCell>
                    <span className={clsx(`inline-block rounded px-2 py-1 text-xs font-medium`, getStatusColor(item.current_status))}>
                      {item.current_status}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <Tooltip>
                      <TooltipContent>{item.deposit?.sender_address}</TooltipContent>
                      <TooltipTrigger>{formatAddress(item.deposit?.sender_address ?? '')}</TooltipTrigger>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{item.deposit?.block_height}</TableCell>
                  <TableCell className="text-sm">{item.deposit ? formatTimestamp(item.deposit.timestamp_ms) : '-'}</TableCell>
                  <TableCell>
                    {item.deposit?.is_finalized ? <span className="text-green-600">✓</span> : <span className="text-gray-400">-</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {pagination.page} of {pagination.total_pages} (Total: {pagination.total_count})
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1 || isLoading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.total_pages || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
