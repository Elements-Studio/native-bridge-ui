import BridgeAssets from '@/pages/BridgeAssets'
import TransactionsDetailPage from '@/pages/Transactions/[:txnHash]/page'
import TransactionsPage from '@/pages/Transactions/page'
// import NewTx from '@/pages/tx/[:txnHash]/page'
import { Route, Routes } from 'react-router-dom'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<BridgeAssets />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/transactions/:txnHash" element={<TransactionsDetailPage />} />
      {/* <Route path="/tx/:txnHash" element={<NewTx />} /> */}
    </Routes>
  )
}
