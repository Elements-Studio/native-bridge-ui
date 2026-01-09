export type ApiChain = 'ethereum' | 'sui' | 'starcoin'
export type ApiTxStatus = 'INITIATED' | 'VERIFYING' | 'CLAIM' | 'DELIVER'

export interface ApiBridgeTxRecord {
  id: string
  from_chain: ApiChain
  to_chain: ApiChain
  token: string
  amount: number
  sender: string
  recipient: string
  initiated_at: string
  status: ApiTxStatus
  tx_hash_from?: string
  tx_hash_to?: string
  seq_num?: string
  verified_signatures?: string[]
  claimed: boolean
  backend_status?: ApiTxStatus
}
