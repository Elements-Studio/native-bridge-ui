import type { Transfer, TransferStatus } from '@/services/types'

export type DerivedBridgePhase = 'not_found' | 'initiated' | 'verifying' | 'claim' | 'delivered'

export type DerivedBridgeStatus = {
  phase: DerivedBridgePhase
  rawStatus: TransferStatus | 'not_found'
  finalized: boolean
  canClaim: boolean
  limiterHold: boolean
}

export function deriveBridgeStatus(transfer?: Transfer | null): DerivedBridgeStatus {
  if (!transfer) {
    return {
      phase: 'not_found',
      rawStatus: 'not_found',
      finalized: false,
      canClaim: false,
      limiterHold: false,
    }
  }

  const { status, is_finalized: finalized } = transfer

  if (status === 'claimed') {
    return { phase: 'delivered', rawStatus: status, finalized, canClaim: false, limiterHold: false }
  }

  if (status === 'approved') {
    return { phase: 'claim', rawStatus: status, finalized, canClaim: true, limiterHold: true }
  }

  // status === 'deposited'
  if (!finalized) {
    return { phase: 'initiated', rawStatus: status, finalized, canClaim: false, limiterHold: false }
  }

  return { phase: 'verifying', rawStatus: status, finalized, canClaim: false, limiterHold: false }
}
