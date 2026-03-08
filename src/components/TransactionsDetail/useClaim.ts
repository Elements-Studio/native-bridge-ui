import useStarcoinTools, { waitForStarcoinTransaction } from '@/hooks/useStarcoinTools'
import { BRIDGE_ABI, BRIDGE_CONFIG } from '@/lib/bridgeConfig'
import { getMetaMask } from '@/lib/evmProvider'
import { bytesToHex, serializeScriptFunctionPayload, serializeU64, serializeU8 } from '@/lib/starcoinBcs'
import { sleep } from '@/lib/utils'
import { getBridgeStatus, getQuota } from '@/services'
import { BrowserProvider, Interface, getAddress } from 'ethers'
import { useCallback, useEffect, useRef } from 'react'
import { BridgeStatus, useTransactionsDetailStore } from './store'

/**
 * Parse amount string like "1.5 USDT" to number (in USDT units)
 */
function parseAmountString(amountStr: string): number {
  const match = amountStr.match(/^([\d.]+)/)
  if (!match) return 0
  return parseFloat(match[1])
}

/**
 * Convert quota to USD units.
 * Quota values from the API are in USD with 8 decimal precision (set by the limiter contract),
 * which is independent of the USDT token precision (6 decimals).
 */
function quotaToUsdt(quota: number | bigint, decimals: number | bigint = 8): number {
  const q = typeof quota === 'bigint' ? Number(quota) : quota
  const d = typeof decimals === 'bigint' ? Number(decimals) : decimals
  return q / Math.pow(10, d)
}

// Chain ID 映射表
const CHAIN_ID_MAP: Record<string, number> = {
  StarcoinMainnet: 0,
  StarcoinTestnet: 1,
  StarcoinCustom: 2,
  EthMainnet: 10,
  EthSepolia: 11,
  EthCustom: 12,
}

// 扩展的 EVM Bridge ABI
const EVM_BRIDGE_ABI = [
  ...BRIDGE_ABI,
  'function approveTransferWithSignatures(bytes[] signatures, tuple(uint8 messageType, uint8 version, uint64 nonce, uint8 chainID, bytes payload) message)',
  'function claimApprovedTransfer(uint8 sourceChainID, uint64 nonce)',
  'function transferApprovals(uint8 sourceChainID, uint64 nonce) view returns (uint256)',
]

/**
 * 提交 claim 到 Starcoin 链 (eth_to_starcoin 方向)
 */
async function submitClaimToStarcoin(nonce: number, sendTransaction: (params: { data: string }) => Promise<unknown>) {
  console.log('[Bridge][Claim] Start submitting claim on Starcoin...')

  // 使用默认的 claim function (claim_bridge_usdt)
  const claimFn = 'claim_bridge_usdt'

  const claimArgs = [serializeU64(Date.now()), serializeU8(BRIDGE_CONFIG.evm.chainId), serializeU64(nonce)]

  const claimPayload = serializeScriptFunctionPayload({
    moduleAddress: BRIDGE_CONFIG.starcoin.packageAddress,
    moduleName: 'Bridge',
    functionName: claimFn,
    typeArgs: [],
    args: claimArgs,
  })

  const txHash = (await sendTransaction({
    data: bytesToHex(claimPayload),
  })) as string

  // Validate txHash - wallet may return null/undefined if user cancels or error occurs
  if (!txHash || typeof txHash !== 'string') {
    throw new Error('Transaction was not submitted. Please try again.')
  }

  console.log('[Bridge][Claim] Starcoin TX submitted:', txHash)

  // Wait for transaction confirmation
  console.log('[Bridge][Claim] Waiting for Starcoin transaction confirmation...')
  try {
    const result = await waitForStarcoinTransaction(txHash, { timeout: 120000, pollInterval: 2000 })
    console.log('[Bridge][Claim] Starcoin TX confirmed:', result)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    // Check if it's a known "already claimed" error
    if (errMsg.includes('ALREADY_CLAIMED') || errMsg.includes('already claimed')) {
      console.warn('[Bridge][Claim] Transaction indicates already claimed, continuing...')
      return
    }
    throw new Error(`Starcoin claim transaction failed: ${errMsg}`)
  }
}

/**
 * 提交 claim 到 Ethereum 链 (starcoin_to_eth 方向)
 */
async function submitClaimToEthereum(sourceChainId: number, nonce: number) {
  console.log('[Bridge][Claim] Start submitting claim on Ethereum...')

  const mm = await getMetaMask()
  if (!mm) throw new Error('MetaMask not detected')

  await mm.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: BRIDGE_CONFIG.evm.chainIdHex }],
  })

  const provider = new BrowserProvider(mm)
  const signer = await provider.getSigner()
  const bridgeAddress = getAddress(BRIDGE_CONFIG.evm.bridgeAddress)
  const bridgeIface = new Interface(EVM_BRIDGE_ABI)

  const claimData = bridgeIface.encodeFunctionData('claimApprovedTransfer', [sourceChainId, nonce])
  console.log('[Bridge] Claim calldata selector:', claimData.slice(0, 10))

  const claimTx = await signer.sendTransaction({ to: bridgeAddress, data: claimData })

  // Wait for tx confirmation with timeout (120s)
  const TX_TIMEOUT_MS = 120000
  const waitPromise = claimTx.wait()
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Transaction confirmation timeout after ${TX_TIMEOUT_MS / 1000}s. TX hash: ${claimTx.hash}`)), TX_TIMEOUT_MS),
  )

  await Promise.race([waitPromise, timeoutPromise])
  console.log('[Bridge][Claim] Done on Ethereum')
}

/**
 * useClaim hook - 处理 claim 交易的提交，包含倒计时逻辑
 */
export function useClaim() {
  const claimingRef = useRef(false)
  const countdownRef = useRef<number | null>(null)

  const direction = useTransactionsDetailStore(state => state.direction)
  const bridgeStatus = useTransactionsDetailStore(state => state.bridgeStatus)
  const transferData = useTransactionsDetailStore(state => state.transferData)
  const claimDelaySeconds = useTransactionsDetailStore(state => state.claimDelaySeconds)
  const claimFailed = useTransactionsDetailStore(state => state.claimFailed)
  const txnHash = useTransactionsDetailStore(state => state.txnHash)
  const setBridgeStatus = useTransactionsDetailStore(state => state.setBridgeStatus)
  const setBridgeError = useTransactionsDetailStore(state => state.setBridgeError)
  const setClaimDelaySeconds = useTransactionsDetailStore(state => state.setClaimDelaySeconds)
  const setClaimFailed = useTransactionsDetailStore(state => state.setClaimFailed)

  const { sendTransaction } = useStarcoinTools()

  // 获取 nonce
  const nonce = transferData?.procedure?.nonce ?? null

  // 获取 source chain id (用于 starcoin_to_eth 方向)
  const sourceChainId = (() => {
    if (!transferData?.procedure) return BRIDGE_CONFIG.starcoin.chainId
    const rawSourceChain = transferData.procedure.source_chain_id
    if (typeof rawSourceChain === 'number') return rawSourceChain
    return CHAIN_ID_MAP[String(rawSourceChain)] ?? BRIDGE_CONFIG.starcoin.chainId
  })()

  const submitClaim = useCallback(async () => {
    if (bridgeStatus !== BridgeStatus.SubmittingClaim) return
    if (claimingRef.current) return
    if (nonce === null) {
      console.error('[Bridge][Claim] No nonce available')
      return
    }

    claimingRef.current = true

    try {
      // Check if bridge is paused before proceeding
      console.log('[Bridge][Claim] Checking bridge paused status...')
      const bridgeStatusData = await getBridgeStatus()
      if (direction === 'eth_to_starcoin' && bridgeStatusData.stc_paused) {
        const errorMsg = 'The bridge is currently paused on Starcoin. Please try again later.'
        console.error('[Bridge][Claim]', errorMsg)
        setBridgeError(errorMsg)
        claimingRef.current = false
        return
      }
      if (direction === 'starcoin_to_eth' && bridgeStatusData.eth_paused) {
        const errorMsg = 'The bridge is currently paused on Ethereum. Please try again later.'
        console.error('[Bridge][Claim]', errorMsg)
        setBridgeError(errorMsg)
        claimingRef.current = false
        return
      }

      // Check quota before proceeding
      const depositAmount = transferData?.procedure?.deposit?.amount
      if (depositAmount) {
        console.log('[Bridge][Claim] Checking quota before claim...')
        const quotaData = await getQuota()
        const decimals = quotaData.decimals ?? 8
        const amountUsdt = parseAmountString(depositAmount)

        // For eth_to_starcoin, check starcoin_claim quota
        // For starcoin_to_eth, check eth_claim quota
        const rawQuota = direction === 'eth_to_starcoin' ? quotaData.starcoin_claim : quotaData.eth_claim

        if (rawQuota == null) {
          // Quota query failed for the target chain, check error message
          const quotaError = direction === 'eth_to_starcoin' ? quotaData.starcoin_error : quotaData.eth_error
          console.warn('[Bridge][Claim] Quota unavailable:', quotaError ?? 'unknown error')
          // Don't block claim if quota is unavailable - proceed with caution
        } else {
          const availableQuota = quotaToUsdt(rawQuota, decimals)
          console.log('[Bridge][Claim] Amount:', amountUsdt, 'USDT, Available quota:', availableQuota, 'USDT')

          if (amountUsdt > availableQuota) {
            const errorMsg = `Quota exceeded. Available: ${availableQuota.toFixed(2)} USDT, Required: ${amountUsdt} USDT. Please try again later.`
            console.error('[Bridge][Claim]', errorMsg)
            setBridgeError(errorMsg)
            claimingRef.current = false
            return
          }
        }
      }

      // 检查是否需要倒计时
      let remainingDelay = claimDelaySeconds ?? 0
      if (remainingDelay > 0) {
        console.log('[Bridge][Claim] Starting claim delay countdown:', remainingDelay)
        countdownRef.current = remainingDelay

        while (remainingDelay > 0) {
          setClaimDelaySeconds(remainingDelay)
          console.log('[Bridge][Claim] Countdown tick:', remainingDelay)
          await sleep(1000)
          remainingDelay -= 1
        }
        setClaimDelaySeconds(0)
        countdownRef.current = null
        console.log('[Bridge][Claim] Claim delay finished')
      }

      if (direction === 'eth_to_starcoin') {
        await submitClaimToStarcoin(nonce, sendTransaction)
      } else {
        await submitClaimToEthereum(sourceChainId, nonce)
      }

      // Claim succeeded - clear failure state
      setClaimFailed(false)
      if (txnHash) {
        localStorage.removeItem(`bridge_claim_failed_${txnHash}`)
      }
      setBridgeStatus(BridgeStatus.Completed)
    } catch (err) {
      console.error('[Bridge][Claim] Failed:', err)
      const errMsg = err instanceof Error ? err.message : 'Claim failed'
      setBridgeError(errMsg)
      // Mark claim as failed so user can manually retry
      setClaimFailed(true)
      if (txnHash) {
        localStorage.setItem(`bridge_claim_failed_${txnHash}`, JSON.stringify({ error: errMsg, timestamp: Date.now() }))
      }
    } finally {
      claimingRef.current = false
    }
  }, [
    bridgeStatus,
    direction,
    nonce,
    sourceChainId,
    claimDelaySeconds,
    transferData,
    txnHash,
    sendTransaction,
    setBridgeStatus,
    setBridgeError,
    setClaimDelaySeconds,
    setClaimFailed,
  ])

  // On page refresh, clear any previous failure state so claim will auto-retry
  useEffect(() => {
    if (!txnHash) return
    const stored = localStorage.getItem(`bridge_claim_failed_${txnHash}`)
    if (stored) {
      console.log('[Bridge][Claim] Page refreshed, clearing previous failure state to retry')
      localStorage.removeItem(`bridge_claim_failed_${txnHash}`)
      // Don't restore failure state - let it auto-retry on refresh
    }
  }, [txnHash])

  // 当状态变为 SubmittingClaim 时自动开始 claim 流程
  useEffect(() => {
    if (bridgeStatus !== BridgeStatus.SubmittingClaim) return
    if (claimingRef.current) return
    if (nonce === null) return

    // 检查是否已经 claimed
    if (transferData?.procedure?.current_status === 'claimed' || transferData?.procedure?.is_complete) {
      setBridgeStatus(BridgeStatus.Completed)
      return
    }

    // If claim has failed in this session, don't auto-retry
    if (claimFailed) {
      console.log('[Bridge][Claim] Claim failed, waiting for page refresh to retry')
      return
    }

    submitClaim()
  }, [bridgeStatus, nonce, claimFailed, transferData?.procedure?.current_status, transferData?.procedure?.is_complete, submitClaim, setBridgeStatus])

  return {
    submitClaim,
    isClaiming: claimingRef.current,
    countdownSeconds: countdownRef.current,
    claimFailed,
  }
}
