export type ChainId = number
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

export interface DepositInfo {
  txn_hash: string
  block_height: number
  timestamp_ms: number
  sender_address: string
  recipient_address: string
  token_id: number
  amount: number
  is_finalized: boolean
}

export interface ApprovalInfo {
  txn_hash: string
  block_height: number
  timestamp_ms: number
  data_source: DataSource
  is_finalized: boolean
}

export interface ClaimInfo {
  txn_hash: string
  block_height: number
  timestamp_ms: number
  claimer_address: string
  gas_usage: number
  data_source: DataSource
  is_finalized: boolean
}

export type ProcedureStatus = 'deposited' | 'approved' | 'claimed'

export interface ProcedureInfo {
  source_chain_id: ChainId
  destination_chain_id: ChainId
  nonce: number
  current_status: ProcedureStatus
  is_complete: boolean
  deposit: DepositInfo
  approval: ApprovalInfo | null
  claim: ClaimInfo | null
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

export interface TransferListItem {
  source_chain_id: ChainId
  destination_chain_id: ChainId
  nonce: number
  current_status: TransferStatus
  is_complete: boolean
  deposit: DepositInfo | null
  approval: ApprovalInfo | null
  claim: ClaimInfo | null
}

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

export interface TransferProcedure {
  source_chain_id: ChainId
  destination_chain_id: ChainId
  nonce: number
  current_status: TransferStatus
  is_complete: boolean
  deposit: DepositInfo | null
  approval: ApprovalInfo | null
  claim: ClaimInfo | null
}

export interface TransferByDepositTxnResponse {
  procedure: ProcedureInfo
  claim_delay_seconds: number
}

export interface TransferListResponse {
  transfers: TransferListItem[]
  pagination: Pagination
  claim_delay_seconds: number
}

export interface QuotaResponse {
  eth_claim: number
  starcoin_claim: number
}

export type StarcoinChainId = 'StarcoinTestnet' | 'StarcoinMainnet' | 'StarcoinCustom'
export type EthChainId = 'EthSepolia' | 'EthMainnet' | 'EthCustom'

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

export interface EthBridgeEvent {
  nonce: number
  source_chain_id: EthChainId
  starcoin_bridge_chain_id: StarcoinChainId
  eth_sender_address: string
  starcoin_bridge_recipient_address: string
  token_id: number
  starcoin_bridge_adjusted_amount: number
}

export interface EthToStarcoinBridgeAction {
  eth_tx_hash: number[]
  eth_event_index: number
  eth_bridge_event: EthBridgeEvent
}

export interface AuthSignature {
  authority_pub_key: string
  signature: string
}

export interface SignatureResponse {
  data:
    | {
        StarcoinToEthBridgeAction: StarcoinToEthBridgeAction
      }
    | {
        EthToStarcoinBridgeAction: EthToStarcoinBridgeAction
      }
  auth_signature: AuthSignature
}

export interface TransferListParams {
  address: string
  status?: TransferStatus
  finalized_only?: boolean
  chain_id?: ChainId
  page?: number
  page_size?: number
}

export type EstimateDirection = 'starcoin_to_eth' | 'eth_to_starcoin'

export interface EstimateFeesResponse {
  source_tx_estimate: string
  combined_approve_and_claim_estimate: string
  approve_estimate: string
  claim_estimate: string
}

export type BridgeRecordStatus = 'INITIATED' | 'VERIFYING' | 'CLAIM' | 'DELIVER'

export interface BridgeRecord {
  id: string
  from_chain: string
  to_chain: string
  token: string
  amount: number
  sender: string
  recipient: string
  initiated_at: string
  status: BridgeRecordStatus
  tx_hash_from?: string
  tx_hash_to?: string
  seq_num?: string
  verified_signatures?: string[]
  claimed: boolean
  backend_status?: BridgeRecordStatus
}
