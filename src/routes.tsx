import BridgeAssets from '@/pages/BridgeAssets'
import { Route, Routes } from 'react-router-dom'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<BridgeAssets />} />
    </Routes>
  )
}
