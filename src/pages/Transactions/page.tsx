import { TransfersTable } from '@/components/Transactions/TransfersTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getTransferList } from '@/services'
import { useGlobalStore } from '@/stores/globalStore'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useSWR from 'swr'

export default function TransactionsPage() {
  const evmWalletInfo = useGlobalStore(state => state.evmWalletInfo)
  const starcoinWalletInfo = useGlobalStore(state => state.starcoinWalletInfo)

  const [searchParams, setSearchParams] = useSearchParams()
  const [evmPage, setEvmPage] = useState(1)
  const [starcoinPage, setStarcoinPage] = useState(1)

  const currentTab = searchParams.get('direction') === 'starcoin_to_eth' ? 'starcoin_to_eth' : 'eth_to_starcoin'

  useEffect(() => {
    if (!searchParams.get('direction')) {
      setSearchParams({ direction: 'eth_to_starcoin' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleTabChange = (value: string) => {
    setSearchParams({ direction: value })
  }

  const { data: evmData, isLoading: evmLoading } = useSWR(
    currentTab === 'eth_to_starcoin' && evmWalletInfo?.address ? ['getTransferList-evm', evmWalletInfo.address, evmPage] : null,
    () => {
      const address = evmWalletInfo?.address
      if (!address) {
        return Promise.resolve({
          transfers: [],
          pagination: { page: 1, page_size: 20, total_count: 0, total_pages: 0 },
          claim_delay_seconds: 0,
        })
      }
      return getTransferList({
        sender: address,
        page: evmPage,
        page_size: 20,
        // finalized_only: true,
      })
    },
  )

  const { data: starcoinData, isLoading: starcoinLoading } = useSWR(
    currentTab === 'starcoin_to_eth' && starcoinWalletInfo?.address
      ? ['getTransferList-starcoin', starcoinWalletInfo.address, starcoinPage]
      : null,
    () => {
      const address = starcoinWalletInfo?.address
      if (!address) {
        return Promise.resolve({
          transfers: [],
          pagination: { page: 1, page_size: 20, total_count: 0, total_pages: 0 },
          claim_delay_seconds: 0,
        })
      }
      return getTransferList({
        sender: address,
        page: starcoinPage,
        page_size: 20,
      })
    },
  )

  return (
    <div className="bg-secondary grid w-full p-4">
      <div className="mx-auto grid w-full max-w-300 content-start gap-4 py-6 md:content-stretch">
        <h1 className="text-2xl font-bold md:col-start-1 md:row-start-1 md:mt-2">Transactions</h1>

        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="grid w-full grid-rows-[auto_1fr] gap-4 md:col-start-1 md:row-start-1"
        >
          <TabsList className="justify-self-center md:justify-self-end">
            <TabsTrigger value="eth_to_starcoin">EVM Wallet</TabsTrigger>
            <TabsTrigger value="starcoin_to_eth">Starcoin Wallet</TabsTrigger>
          </TabsList>

          <TabsContent value="eth_to_starcoin" className="space-y-4">
            {!evmWalletInfo?.address ? (
              <div className="py-8 text-center text-gray-500">Please connect your EVM wallet</div>
            ) : (
              <TransfersTable
                data={evmData?.transfers || []}
                pagination={evmData?.pagination || { page: 1, page_size: 20, total_count: 0, total_pages: 0 }}
                isLoading={evmLoading}
                onPageChange={setEvmPage}
                direction="eth_to_starcoin"
              />
            )}
          </TabsContent>

          <TabsContent value="starcoin_to_eth" className="space-y-4">
            {!starcoinWalletInfo?.address ? (
              <div className="py-8 text-center text-gray-500">Please connect your Starcoin wallet</div>
            ) : (
              <TransfersTable
                data={starcoinData?.transfers || []}
                pagination={starcoinData?.pagination || { page: 1, page_size: 20, total_count: 0, total_pages: 0 }}
                isLoading={starcoinLoading}
                onPageChange={setStarcoinPage}
                direction="starcoin_to_eth"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
