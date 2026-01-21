import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Pagination, TransferListItem } from '@/services/types'

interface TransfersTableProps {
  data: TransferListItem[]
  pagination: Pagination
  isLoading: boolean
  onPageChange: (page: number) => void
}

export function TransfersTable({ data, pagination, isLoading, onPageChange }: TransfersTableProps) {
  const formatTimestamp = (ms: number) => {
    return new Date(ms).toLocaleString()
  }

  const formatHash = (hash: string) => {
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`
  }

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nonce</TableHead>
              <TableHead>Chain ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Transaction Hash</TableHead>
              <TableHead>Sender Address</TableHead>
              <TableHead>Block Height</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Data Source</TableHead>
              <TableHead>Finalized</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-gray-500">
                  {isLoading ? 'Loading...' : 'No transactions found'}
                </TableCell>
              </TableRow>
            ) : (
              data.map(item => (
                <TableRow key={`${item.chain_id}-${item.nonce}`}>
                  <TableCell>{item.nonce}</TableCell>
                  <TableCell>{item.chain_id}</TableCell>
                  <TableCell>
                    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <a href={`#`} title={item.txn_hash} className="text-blue-600 hover:underline">
                      {formatHash(item.txn_hash)}
                    </a>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatAddress(item.sender_address)}</TableCell>
                  <TableCell>{item.block_height}</TableCell>
                  <TableCell className="text-sm">{formatTimestamp(item.timestamp_ms)}</TableCell>
                  <TableCell>{item.data_source}</TableCell>
                  <TableCell>
                    {item.is_finalized ? <span className="text-green-600">✓</span> : <span className="text-gray-400">-</span>}
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
