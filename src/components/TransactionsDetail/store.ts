import type { EstimateDirection, SignatureResponse, TransferByDepositTxnResponse } from '@/services/types'
import { create } from 'zustand'

export const BridgeStatus = {
  WaitingForIndexer: 'WaitingForIndexer',
  CollectingValidatorSignatures: 'CollectingValidatorSignatures',
  SubmittingApprove: 'SubmittingApprove',
  SubmittingClaim: 'SubmittingClaim',
  AlreadyClaimed: 'AlreadyClaimed',
  Completed: 'Completed',
} as const

export type BridgeStatus = (typeof BridgeStatus)[keyof typeof BridgeStatus]

export const BridgeStatusLabelMap: Record<BridgeStatus, string> = {
  [BridgeStatus.WaitingForIndexer]: 'Waiting for indexer, it may take a few minutes',
  [BridgeStatus.CollectingValidatorSignatures]: 'Collecting validator signatures',
  [BridgeStatus.SubmittingApprove]: 'Submitting approve',
  [BridgeStatus.SubmittingClaim]: 'Submitting claim',
  [BridgeStatus.Completed]: 'completed',
  [BridgeStatus.AlreadyClaimed]: 'Already claimed',
}

type TransactionsDetailState = {
  direction: EstimateDirection
  txnHash: string | null
  bridgeStatus: BridgeStatus
  bridgeError: string | null
  claimDelaySeconds: number | null
  transferData: TransferByDepositTxnResponse | null
  signatures: SignatureResponse[]
  isCollectingSignatures: boolean
  setDirection: (direction: EstimateDirection) => void
  setTxnHash: (hash: string | null) => void
  setBridgeStatus: (status: BridgeStatus) => void
  setBridgeError: (error: string | null) => void
  setClaimDelaySeconds: (seconds: number | null) => void
  setTransferData: (data: TransferByDepositTxnResponse | null) => void
  setSignatures: (signatures: SignatureResponse[]) => void
  setIsCollectingSignatures: (isCollecting: boolean) => void
  reset: () => void
}

const initialState = {
  direction: 'eth_to_starcoin' as EstimateDirection,
  txnHash: null as string | null,
  bridgeStatus: BridgeStatus.WaitingForIndexer,
  bridgeError: null as string | null,
  claimDelaySeconds: null as number | null,
  transferData: null as TransferByDepositTxnResponse | null,
  signatures: [] as SignatureResponse[],
  isCollectingSignatures: false,
}

export const useTransactionsDetailStore = create<TransactionsDetailState>(set => ({
  ...initialState,
  setDirection: direction => set({ direction }),
  setTxnHash: txnHash => set({ txnHash }),
  setBridgeStatus: bridgeStatus => set({ bridgeStatus }),
  setBridgeError: bridgeError => set({ bridgeError }),
  setClaimDelaySeconds: claimDelaySeconds => set({ claimDelaySeconds }),
  setTransferData: data =>
    set({
      transferData: data,
      claimDelaySeconds: data?.claim_delay_seconds ?? null,
    }),
  setSignatures: signatures => set({ signatures }),
  setIsCollectingSignatures: isCollectingSignatures => set({ isCollectingSignatures }),
  reset: () => set({ ...initialState }),
}))
