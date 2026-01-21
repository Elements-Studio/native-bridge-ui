import { TransfersTable } from '@/components/Transactions/TransfersTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getTransferList } from '@/services'
import { useGlobalStore } from '@/stores/globalStore'
import { useState } from 'react'
import useSWR from 'swr'

export default function TransactionsPage() {
  const { evmWalletInfo, starcoinWalletInfo } = useGlobalStore()
  const [evmPage, setEvmPage] = useState(1)
  const [starcoinPage, setStarcoinPage] = useState(1)

  const { data: evmData, isLoading: evmLoading } = useSWR(
    evmWalletInfo?.address ? ['getTransferList-evm', evmWalletInfo.address, evmPage] : null,
    () => {
      const address = evmWalletInfo?.address
      if (!address) return Promise.resolve({ transfers: [], pagination: { page: 1, page_size: 20, total_count: 0, total_pages: 0 } })
      return getTransferList({
        address,
        page: evmPage,
        page_size: 20,
        // finalized_only: true,
      })
    },
  )

  const { data: starcoinData, isLoading: starcoinLoading } = useSWR(
    starcoinWalletInfo?.address ? ['getTransferList-starcoin', starcoinWalletInfo.address, starcoinPage] : null,
    () => {
      const address = starcoinWalletInfo?.address
      if (!address) return Promise.resolve({ transfers: [], pagination: { page: 1, page_size: 20, total_count: 0, total_pages: 0 } })
      return getTransferList({
        address,
        page: starcoinPage,
        page_size: 20,
        finalized_only: true,
      })
    },
  )

  return (
    <div className="w-full">
      <h1 className="mb-6 text-2xl font-bold">Transactions</h1>

      <Tabs defaultValue="evm" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="evm">EVM Wallet</TabsTrigger>
          <TabsTrigger value="starcoin">Starcoin Wallet</TabsTrigger>
        </TabsList>

        <TabsContent value="evm" className="space-y-4">
          {!evmWalletInfo?.address ? (
            <div className="py-8 text-center text-gray-500">Please connect your EVM wallet</div>
          ) : (
            <TransfersTable
              data={evmData?.transfers || []}
              pagination={evmData?.pagination || { page: 1, page_size: 20, total_count: 0, total_pages: 0 }}
              isLoading={evmLoading}
              onPageChange={setEvmPage}
            />
          )}
        </TabsContent>

        <TabsContent value="starcoin" className="space-y-4">
          {!starcoinWalletInfo?.address ? (
            <div className="py-8 text-center text-gray-500">Please connect your Starcoin wallet</div>
          ) : (
            <TransfersTable
              data={starcoinData?.transfers || []}
              pagination={starcoinData?.pagination || { page: 1, page_size: 20, total_count: 0, total_pages: 0 }}
              isLoading={starcoinLoading}
              onPageChange={setStarcoinPage}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
