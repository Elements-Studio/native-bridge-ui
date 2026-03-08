import { useGlobalStore } from '@/stores/globalStore'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BridgeStatus, useTransactionsDetailStore } from './store'

// 延遲時間，避免初始加載時閃爍
const WALLET_CHECK_DELAY_MS = 1500

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}

export default function StatusButton() {
  const { t } = useTranslation()
  const bridgeError = useTransactionsDetailStore(state => state.bridgeError)
  const bridgeStatus = useTransactionsDetailStore(state => state.bridgeStatus)
  const approveFailed = useTransactionsDetailStore(state => state.approveFailed)
  const claimFailed = useTransactionsDetailStore(state => state.claimFailed)
  const claimDelaySeconds = useTransactionsDetailStore(state => state.claimDelaySeconds)

  const evmWalletInfo = useGlobalStore(state => state.evmWalletInfo)
  const starcoinWalletInfo = useGlobalStore(state => state.starcoinWalletInfo)

  // 初始狀態設為 true，延遲後再檢查實際狀態
  const [isWalletsConnected, setIsWalletsConnected] = useState(true)
  const [isCheckingWallets, setIsCheckingWallets] = useState(true)

  useEffect(() => {
    // 延遲檢查錢包狀態，避免初始加載時閃爍
    const timer = setTimeout(() => {
      setIsWalletsConnected(Boolean(evmWalletInfo?.address && starcoinWalletInfo?.address))
      setIsCheckingWallets(false)
    }, WALLET_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [evmWalletInfo?.address, starcoinWalletInfo?.address])

  // 計算是否應該顯示按鈕
  const shouldShowButton =
    bridgeError ||
    approveFailed ||
    claimFailed ||
    bridgeStatus === BridgeStatus.SubmittingClaim ||
    bridgeStatus === BridgeStatus.Completed ||
    (!isCheckingWallets && !isWalletsConnected)

  if (!shouldShowButton) {
    return null
  }

  // 計算按鈕樣式
  const getButtonClassName = () => {
    const baseClass = 'flex items-center rounded-xl px-6 py-2.5 text-xl transition-colors duration-200 cursor-not-allowed'

    if (bridgeError || approveFailed || claimFailed || (!isCheckingWallets && !isWalletsConnected)) {
      return `${baseClass} bg-red-100 text-red-800`
    }
    if (bridgeStatus === BridgeStatus.Completed) {
      return `${baseClass} bg-accent-foreground/20 text-accent-foreground`
    }
    return `${baseClass} bg-secondary text-secondary-foreground`
  }

  // 計算按鈕文案
  const getButtonText = () => {
    if (bridgeStatus === BridgeStatus.Completed) {
      return t('status.completed')
    }
    if (!isCheckingWallets && !isWalletsConnected) {
      return t('wallet.connectWallets')
    }
    if (approveFailed) {
      return t('error.approveFailed')
    }
    if (claimFailed || bridgeError) {
      return t('error.claimFailed')
    }

    // Show countdown if in claim stage with delay
    if (bridgeStatus === BridgeStatus.SubmittingClaim && claimDelaySeconds != null && claimDelaySeconds > 0) {
      return t('status.claimingIn', { time: formatCountdown(claimDelaySeconds) })
    }

    return t('status.waitingForClaim')
  }

  return (
    <button disabled className={getButtonClassName()}>
      {getButtonText()}
    </button>
  )
}
