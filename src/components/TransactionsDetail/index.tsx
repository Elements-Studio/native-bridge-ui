import { Progress } from '@/components/ui/progress'
import { normalizeHash } from '@/lib/format'
import { getTransferByDepositTxn } from '@/services'
import { ArrowBigRight, CheckIcon, InfoIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import useSWR from 'swr'
import { Spinner } from '../ui/spinner'
import ApprovalCard from './ApprovalCard'
import ClaimCard from './ClaimCard'
import DepositCard from './DepositCard'
import { BridgeStatus, BridgeStatusLabelMap, useTransactionsDetailStore } from './store'

const formatDelayTime = (seconds: number | null): string => {
  if (seconds === null) return 'calculating...'
  if (seconds <= 0) return 'Ready'
  return `${seconds} seconds`
}

export default function TransactionsDetail() {
  const [isPending, setIsPending] = useState(true)
  const [searchParams] = useSearchParams()
  const direction = useTransactionsDetailStore(state => state.direction)
  const setDirection = useTransactionsDetailStore(state => state.setDirection)
  const setTxnHash = useTransactionsDetailStore(state => state.setTxnHash)
  const bridgeError = useTransactionsDetailStore(state => state.bridgeError)
  const bridgeStatus = useTransactionsDetailStore(state => state.bridgeStatus)
  const claimDelaySeconds = useTransactionsDetailStore(state => state.claimDelaySeconds)
  const setTransferData = useTransactionsDetailStore(state => state.setTransferData)
  const setBridgeStatus = useTransactionsDetailStore(state => state.setBridgeStatus)

  useEffect(() => {
    const directionParam = searchParams.get('direction')
    if (directionParam === 'starcoin_to_eth' || directionParam === 'eth_to_starcoin') {
      setDirection(directionParam)
    }
  }, [searchParams, setDirection])

  // 从 URL 参数中获取 txnHash 并设置到 store 中
  const { txnHash: qsTxnHash } = useParams()
  const txnHash = normalizeHash(qsTxnHash || '')
  useEffect(() => {
    setTxnHash(txnHash || null)
  }, [txnHash, setTxnHash])

  // 轮询获取交易状态，直到拿到数据
  const { data: transferData, isLoading: isTransferLoading } = useSWR(
    txnHash ? ['transferByDepositTxn', txnHash] : null,
    ([, hash]) => getTransferByDepositTxn(hash),
    {
      refreshInterval: data => {
        // 如果已拿到数据且 is_complete 为 true，停止轮询
        if (data?.procedure?.is_complete) return 0
        return 3000
      },
      revalidateOnFocus: false,
      onSuccess: data => setTransferData(data),
    },
  )

  // bridgeStatus 和 bridgeError 同步到 store 中
  useEffect(() => {
    if (!transferData) return
    const status: BridgeStatus | undefined = (() => {
      const procedure = transferData.procedure
      if (!procedure) return
      if (procedure.is_complete || procedure.current_status === 'claimed') {
        return BridgeStatus.Completed
      }

      if (procedure.approval && procedure.approval.is_finalized) {
        return BridgeStatus.SubmittingClaim
      }
      if (procedure.approval) {
        return BridgeStatus.SubmittingApprove
      }
      if (procedure.deposit && procedure.deposit.is_finalized) {
        return BridgeStatus.CollectingValidatorSignatures
      }
      return BridgeStatus.WaitingForIndexer
    })()

    if (status) {
      setBridgeStatus(status)
    }
  }, [transferData, setBridgeStatus])

  const statusLabel = useMemo(() => {
    const pendingCls = 'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground/90'
    const readyToClaimCls = 'bg-accent/20 text-accent hover:bg-accent/10 hover:text-accent/90'
    const completedCls = 'bg-accent-foreground/20 text-accent-foreground hover:bg-accent-foreground/10 hover:text-accent-foreground/90'
    const failedCls = 'bg-red-100 text-red-800 hover:bg-red-100/80 hover:text-red-800/90'
    if (bridgeError)
      return {
        label: 'Failed',
        cls: failedCls,
      }
    if (transferData?.procedure?.is_complete)
      return {
        label: 'Completed',
        cls: completedCls,
      }
    if (transferData?.procedure?.current_status === 'claimed')
      return {
        label: 'Completed',
        cls: completedCls,
      }
    if (transferData?.procedure?.current_status === 'approved') {
      return {
        label: 'Approved',
        cls: completedCls,
      }
    }
    if (transferData?.procedure?.deposit?.is_finalized)
      return {
        label: 'Ready to claim',
        cls: readyToClaimCls,
      }
    if (bridgeStatus)
      return {
        label: BridgeStatusLabelMap[bridgeStatus],
        cls: pendingCls,
      }
    if (isTransferLoading)
      return {
        label: 'Loading...',
        cls: pendingCls,
      }
    return {
      label: 'Pending',
      cls: pendingCls,
    }
  }, [bridgeError, bridgeStatus, isTransferLoading, transferData])
  const progressValue = useMemo(() => {
    if (bridgeError) return 0
    if (!bridgeStatus) return 0
    if (bridgeStatus === BridgeStatus.WaitingForIndexer) return 20
    if (bridgeStatus === BridgeStatus.CollectingValidatorSignatures) return direction === 'starcoin_to_eth' ? 50 : 40
    if (bridgeStatus === BridgeStatus.SubmittingApprove) return 60
    if (bridgeStatus === BridgeStatus.SubmittingClaim) return 80
    if (bridgeStatus === BridgeStatus.Completed || bridgeStatus === BridgeStatus.AlreadyClaimed) return 100
    return 0
  }, [bridgeError, bridgeStatus, direction])

  const progressSteps = useMemo(() => {
    if (direction === 'starcoin_to_eth') {
      return [
        { label: 'Waiting for finalization', value: 20 },
        { label: 'Collecting signatures', value: 50 },
        { label: 'Submitting claim', value: 80 },
        { label: 'Completed', value: 100 },
      ]
    }
    return [
      { label: 'Waiting for finalization', value: 20 },
      { label: 'Collecting signatures', value: 40 },
      { label: 'Approving transfer', value: 60 },
      { label: 'Claiming tokens', value: 80 },
      { label: 'Completed', value: 100 },
    ]
  }, [direction])
  const progressGridClass = direction === 'starcoin_to_eth' ? 'grid-cols-4' : 'grid-cols-5'

  return (
    <div className="bg-secondary grid w-full p-4">
      <div className="mx-auto grid w-full max-w-300 content-start gap-4 py-6">
        <h1 className="text-2xl font-bold">Transaction Details</h1>

        <div className="bg-accent/20 border-accent-foreground/10 grid gap-y-5 rounded-3xl border p-7.5">
          <div className="flex items-center justify-between">
            <div className="grid gap-1.5">
              <div className="text-secondary-foreground text-lg font-bold">
                {direction === 'eth_to_starcoin' ? 'From Ethereum to Starcoin' : 'From Starcoin to Ethereum'}
              </div>
            </div>

            <button
              className={`${statusLabel.cls} flex cursor-pointer items-center rounded-xl px-6 py-2.5 text-xl transition-colors duration-200`}
            >
              {statusLabel.label}
              <Spinner className="ms-5" />
            </button>
          </div>

          {/* Progress Steps Section */}
          <div className="mt-7.5 grid">
            <Progress value={progressValue} className={`z-0 col-start-1 row-start-1 mx-[12%] mt-4.5 ${bridgeError ? 'bg-gray-600' : ''}`} />
            <div className={`z-2 col-start-1 row-start-1 grid ${progressGridClass} gap-2`}>
              {progressSteps.map((step, index) => (
                <div key={index} className="grid content-start justify-center gap-y-4">
                  <div
                    className={`grid aspect-square w-10 place-content-center justify-self-center rounded-full p-2 transition-colors ${
                      progressValue >= step.value
                        ? bridgeError && progressValue === 100
                          ? 'bg-accent-foreground text-primary-foreground'
                          : 'bg-accent text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {isPending ? <Spinner /> : <CheckIcon />}
                  </div>
                  <span className="text-primary-foreground text-center text-sm font-semibold uppercase md:text-lg">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 提示信息 */}
          {bridgeStatus !== 'Completed' && bridgeStatus !== 'WaitingForIndexer' && (
            <div className="bg-secondary border-secondary-foreground/30 mt-4 flex items-center gap-x-3 rounded-xl border p-5">
              <InfoIcon />
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="text-primary-foreground text-lg font-bold">
                  {direction === 'eth_to_starcoin' ? 'Ethereum' : 'Starcoin'} may take {formatDelayTime(claimDelaySeconds)} or more
                </div>
                {bridgeStatus ? <div className="text-accent-foreground w-full text-sm">{BridgeStatusLabelMap[bridgeStatus]}</div> : null}
                {bridgeError ? <div className="text-secondary-foreground w-full text-sm">{bridgeError}</div> : null}
              </div>
            </div>
          )}
          {/*卡片*/}
          <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            {/* 左侧卡片 */}
            <DepositCard />
            <div className="flex items-center justify-center self-center">
              <ArrowBigRight className="text-secondary-foreground h-8 w-8" />
            </div>
            {/* 右侧卡片 */}

            {bridgeStatus === 'Completed' ? <ClaimCard /> : <ApprovalCard />}
          </div>
        </div>
      </div>
    </div>
  )
}
