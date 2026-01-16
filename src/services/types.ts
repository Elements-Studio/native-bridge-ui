export type ChainId = 1 | 11
export type TransferStatus = 'deposited' | 'approved' | 'claimed'
export type DataSource = 'STARCOIN' | 'ETH'

export interface TransferData {
  destination_chain: ChainId
  recipient_address: string
  token_id: number
  amount: number
}

export interface StatusHistoryItem {
  status: TransferStatus
  block_height: number
  timestamp_ms: number
  txn_hash: string
  data_source: DataSource
}

export interface Transfer {
  chain_id: ChainId
  nonce: number
  status: TransferStatus
  block_height: number
  timestamp_ms: number
  txn_hash: string
  sender_address: string
  is_finalized: boolean
  data_source: DataSource
  gas_usage: number
  transfer_data?: TransferData
  status_history?: StatusHistoryItem[]
}

export type TransferListItem = Omit<Transfer, 'transfer_data' | 'status_history' | 'gas_usage'>

export interface Pagination {
  page: number
  page_size: number
  total_count: number
  total_pages: number
}

export interface HealthResponse {
  service: string
  status: string
}

export interface TransferDetailResponse {
  transfer: Transfer
}

export interface TransferListResponse {
  transfers: TransferListItem[]
  pagination: Pagination
}

export interface QuotaResponse {
  eth_claim: number
  starcoin_claim: number
}

export type StarcoinChainId = 'StarcoinTestnet' | 'StarcoinMainnet'
export type EthChainId = 'EthSepolia' | 'EthMainnet'

export interface StarcoinBridgeEvent {
  nonce: number
  starcoin_bridge_chain_id: StarcoinChainId
  eth_chain_id: EthChainId
  starcoin_bridge_address: string
  eth_address: string
  token_id: number
  amount_starcoin_bridge_adjusted: number
}

export interface StarcoinToEthBridgeAction {
  starcoin_bridge_tx_digest: number[]
  starcoin_bridge_tx_event_index: number
  starcoin_bridge_event: StarcoinBridgeEvent
}

export interface AuthSignature {
  authority_pub_key: string
  signature: string
}

export interface SignatureResponse {
  data: {
    StarcoinToEthBridgeAction: StarcoinToEthBridgeAction
  }
  auth_signature: AuthSignature
}

export interface TransferListParams {
  address: string
  page?: number
  page_size?: number
}
