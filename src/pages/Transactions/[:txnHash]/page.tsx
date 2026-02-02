import ethIcon from '@/assets/img/eth.svg'
import sepoliaEthIcon from '@/assets/img/sepolia_eth.svg'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { BRIDGE_ABI, BRIDGE_CONFIG, normalizeHex } from '@/lib/bridgeConfig'
import { getMetaMask } from '@/lib/evmProvider'
import { normalizeHash } from '@/lib/format'
import { bytesToHex, hexToBytes, serializeBytes, serializeScriptFunctionPayload, serializeU64, serializeU8 } from '@/lib/starcoinBcs'
import { collectSignatures, getTransferDetail, getTransferList, type SignatureResponse } from '@/services'
import type { EstimateDirection, TransferListItem } from '@/services/types'
import { useGlobalStore } from '@/stores/globalStore'
import { BrowserProvider, Contract, Interface, getAddress } from 'ethers'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const CHAIN_ID_MAP: Record<string, number> = {
  StarcoinMainnet: 0,
  StarcoinTestnet: 1,
  StarcoinCustom: 2,
  EthMainnet: 10,
  EthSepolia: 11,
  EthCustom: 12,
}

const EVM_BRIDGE_ABI = [
  ...BRIDGE_ABI,
  'function approveTransferWithSignatures(bytes[] signatures, tuple(uint8 messageType, uint8 version, uint64 nonce, uint8 chainID, bytes payload) message)',
  'function claimApprovedTransfer(uint8 sourceChainID, uint64 nonce)',
  'function transferApprovals(uint8 sourceChainID, uint64 nonce) view returns (uint256)',
]

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function serializeU64BE(value: number | bigint): Uint8Array {
  let v = BigInt(value)
  const out = new Uint8Array(8)
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

function normalizeHexLen(input: string, expectedBytes: number): string {
  const trimmed = input.trim()
  let hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: ${input}`)
  }
  if (hex.length > expectedBytes * 2) {
    throw new Error(`Invalid hex length: expected <= ${expectedBytes} bytes, got ${hex.length / 2}`)
  }
  if (hex.length < expectedBytes * 2) {
    hex = hex.padStart(expectedBytes * 2, '0')
  }
  return `0x${hex}`
}

function getEthSenderAddress(event: Record<string, unknown>) {
  return (
    (event.eth_sender_address as string | undefined) ??
    (event.eth_address as string | undefined) ??
    (event.ethAddress as string | undefined)
  )
}

function getStarcoinRecipientAddress(event: Record<string, unknown>) {
  return (
    (event.starcoin_bridge_recipient_address as string | undefined) ??
    (event.starcoin_bridge_address as string | undefined) ??
    (event.starcoinBridgeRecipientAddress as string | undefined)
  )
}

function base64ToHex(input: string): string {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(`${normalized}${padding}`)
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

function base64ToBytes(input: string): Uint8Array {
  return hexToBytes(base64ToHex(input))
}

async function getEthEventIndex(txHash: string): Promise<number> {
  const todo = async () => {
    const normalizedTxHash = txHash.startsWith('0x') ? txHash : `0x${txHash}`
    const mm = await getMetaMask()
    if (!mm) throw new Error('MetaMask not detected')

    const provider = new BrowserProvider(mm)

    const receipt = await provider.getTransactionReceipt(normalizedTxHash)

    if (!receipt) throw new Error('Transaction receipt not found')

    const iface = new Interface(BRIDGE_ABI)
    const event = iface.getEvent('TokensDeposited')
    const eventTopic = event?.topicHash
    if (!eventTopic) throw new Error('TokensDeposited topic not found')

    const bridgeAddress = BRIDGE_CONFIG.evm.bridgeAddress.toLowerCase()
    const logs = receipt.logs || []
    for (let i = 0; i < logs.length; i += 1) {
      const log = logs[i]
      if (!log?.address || log.address.toLowerCase() !== bridgeAddress) continue
      if (log.topics?.[0] === eventTopic) return i
    }
    throw new Error('TokensDeposited event not found in receipt logs')
  }
  const res = await todo()
  return res
}

export default function TransactionsDetailPage() {
  const { txnHash } = useParams()
  const [searchParams] = useSearchParams()

  const currentCoin = useGlobalStore(state => state.currentCoin)
  const evmWalletInfo = useGlobalStore(state => state.evmWalletInfo)
  const starcoinWalletInfo = useGlobalStore(state => state.starcoinWalletInfo)

  const direction: EstimateDirection = searchParams.get('direction') === 'starcoin_to_eth' ? 'starcoin_to_eth' : 'eth_to_starcoin'
  const { sendTransaction } = useStarcoinTools()
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [claimDelaySeconds, setClaimDelaySeconds] = useState<number | null>(null)
  const isDev = import.meta.env.DEV
  const claimDelayCapSeconds = 0
  const startedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!txnHash) return
    if (!evmWalletInfo?.address) {
      setBridgeError('Please connect your EVM wallet.')
      return
    }
    if (!starcoinWalletInfo?.address) {
      setBridgeError('Please connect your Starcoin wallet.')
      return
    }

    const tokenConfig = BRIDGE_CONFIG.tokens[currentCoin.name as keyof typeof BRIDGE_CONFIG.tokens]
    if (direction === 'eth_to_starcoin' && !tokenConfig) {
      setBridgeError('Selected token is not supported for ETH → Starcoin.')
      return
    }

    const runKey = `${direction}:${txnHash}`
    if (startedRef.current === runKey) return
    startedRef.current = runKey
    let cancelled = false
    const findMatchingTransfer = (transfers: TransferListItem[] | undefined, targetHash: string) => {
      if (!transfers) return null
      return (
        transfers.find(t => {
          const candidates = [t.deposit?.txn_hash, t.approval?.txn_hash, t.claim?.txn_hash, (t as { txn_hash?: string }).txn_hash]
          return candidates.some(hash => (hash ? normalizeHash(hash) === targetHash : false))
        }) ?? null
      )
    }

    const run = async () => {
      setBridgeError(null)
      setIsProcessing(true)
      try {
        if (direction === 'eth_to_starcoin') {
          setBridgeStatus('Waiting for indexer finalization...')
          let nonce: number | null = null
          const pollStart = Date.now()
          const pollTimeoutMs = 10 * 60 * 1000
          let transferStatus: string | null = null
          let isFinalized = false
          const normalizedTxHash = normalizeHash(txnHash)
          let claimDelay = 0

          while (Date.now() - pollStart < pollTimeoutMs) {
            if (cancelled) return
            try {
              const list = await getTransferList({
                address: evmWalletInfo.address,
                page_size: 20,
                page: 1,
              })
              console.log('[Bridge] Poll page 1/?:', {
                direction,
                address: evmWalletInfo.address,
                total: list.pagination?.total_count,
                pages: list.pagination?.total_pages,
              })
              if (list.claim_delay_seconds != null) {
                const adjustedDelay = isDev ? Math.min(list.claim_delay_seconds, claimDelayCapSeconds) : list.claim_delay_seconds
                claimDelay = adjustedDelay
                setClaimDelaySeconds(adjustedDelay)
              }
              console.log('[Bridge] Looking for txHash:', normalizedTxHash)
              console.log(
                '[Bridge] Available transfers:',
                list.transfers.map(t => ({
                  txn_hash: t.deposit?.txn_hash,
                  normalized: normalizeHash(t.deposit?.txn_hash ?? ''),
                  is_finalized: t.deposit?.is_finalized,
                  deposit: t.deposit,
                })),
              )
              let matched = findMatchingTransfer(list.transfers, normalizedTxHash)
              const totalPages = list.pagination?.total_pages ?? 1
              if (!matched && totalPages > 1) {
                for (let page = 2; page <= totalPages; page += 1) {
                  if (cancelled) return
                  const pageList = await getTransferList({
                    address: evmWalletInfo.address,
                    page_size: 20,
                    page,
                  })
                  console.log('[Bridge] Poll page', page, '/', totalPages, 'transfers:', pageList.transfers.length)
                  matched = findMatchingTransfer(pageList.transfers, normalizedTxHash)
                  if (matched) break
                }
              }
              console.log('[Bridge] Match result:', matched ? { nonce: matched.nonce, status: matched.current_status } : 'NOT_FOUND')
              console.log('[Bridge] Matched:', matched)
              console.log('[Bridge] Matched deposit:', matched?.deposit)
              console.log('[Bridge] is_finalized:', matched?.deposit?.is_finalized)
              if (matched) {
                nonce = Number(matched.nonce)
                transferStatus = matched.current_status
                if (matched.deposit?.is_finalized) {
                  console.log('[Bridge] Finalized transfer found, preparing next step')
                  setBridgeStatus('Indexer finalized, preparing...')
                  isFinalized = true
                  break
                }
              }
            } catch (err) {
              console.debug('Transfer list not ready:', err)
            }
            await sleep(6000)
          }

          console.log('[Bridge] Poll finished:', {
            isFinalized,
            nonce,
            transferStatus,
            claimDelay,
          })
          if (!isFinalized) {
            throw new Error('Transfer not finalized yet')
          }

          // 等待倒计时结束
          if (claimDelay > 0) {
            console.log('[Bridge] Starting claim delay countdown:', claimDelay)
            setBridgeStatus(`Waiting for claim delay (${claimDelay}s)...`)
            while (claimDelay > 0) {
              if (cancelled) return
              setClaimDelaySeconds(claimDelay)
              setBridgeStatus(`Waiting for claim delay (${claimDelay}s)...`)
              console.log('[Bridge] Countdown tick:', claimDelay)
              await sleep(1000)
              claimDelay -= 1
            }
            setClaimDelaySeconds(0)
            console.log('[Bridge] Claim delay finished')
          }

          if (nonce === null || !Number.isFinite(nonce)) {
            throw new Error('Indexer did not return transfer nonce')
          }

          if (transferStatus === null) {
            const detail = await getTransferDetail(BRIDGE_CONFIG.evm.chainId, nonce)

            transferStatus = detail.transfer.status
          }

          if (transferStatus === 'claimed') {
            setBridgeStatus('Already claimed on Starcoin.')
            return
          }

          let signatures: SignatureResponse[] = []
          if (transferStatus !== 'approved') {
            console.log('[Bridge] Next step: collect signatures')
            setBridgeStatus('Collecting validator signatures...')
            const eventIndex = await getEthEventIndex(txnHash)
            console.log('[Bridge] Event index:', eventIndex)
            signatures = await collectSignatures('eth_to_starcoin', txnHash, eventIndex, { validatorCount: 3 })
            console.log('[Bridge] Signatures collected:', signatures.length)
          }

          if (transferStatus !== 'approved') {
            console.info('[Bridge][Approve] start')
            setBridgeStatus('Submitting approve on Starcoin...')

            const uniqueSignatures = signatures.filter((sig, index, list) => {
              const key = sig.auth_signature.authority_pub_key
              return list.findIndex(item => item.auth_signature.authority_pub_key === key) === index
            })
            if (uniqueSignatures.length < 3) {
              console.log('Signatures collected:', uniqueSignatures)
              throw new Error('Need signatures from 3 distinct validators.')
            }

            const first = uniqueSignatures[0]?.data
            if (!first || !('EthToStarcoinBridgeAction' in first)) {
              throw new Error('Invalid signature response')
            }
            const action = first.EthToStarcoinBridgeAction
            const event = action.eth_bridge_event
            const ethSenderAddress = getEthSenderAddress(event as unknown as Record<string, unknown>) ?? evmWalletInfo.address
            const starcoinRecipientAddress =
              getStarcoinRecipientAddress(event as unknown as Record<string, unknown>) ?? starcoinWalletInfo.address
            if (!ethSenderAddress || !starcoinRecipientAddress) {
              throw new Error('Signature response missing sender or recipient address')
            }

            const sigBytes = uniqueSignatures.map(sig => base64ToBytes(sig.auth_signature.signature))
            const approveFn = 'approve_bridge_token_transfer_three'

            const senderAddressBytes = hexToBytes(normalizeHex(ethSenderAddress, 20))
            const recipientAddressBytes = hexToBytes(normalizeHex(starcoinRecipientAddress, 16))
            const signatureBytes = sigBytes.slice(0, 3)

            const approveArgs = [
              serializeU8(BRIDGE_CONFIG.evm.chainId),
              serializeU64(event.nonce),
              serializeBytes(senderAddressBytes),
              serializeU8(BRIDGE_CONFIG.evm.destinationChainId),
              serializeBytes(recipientAddressBytes),
              serializeU8(event.token_id),
              serializeU64(event.starcoin_bridge_adjusted_amount),
              ...signatureBytes.map(sig => serializeBytes(sig)),
            ]

            const approvePayload = serializeScriptFunctionPayload({
              moduleAddress: BRIDGE_CONFIG.starcoin.packageAddress,
              moduleName: 'Bridge',
              functionName: approveFn,
              typeArgs: [],
              args: approveArgs,
            })

            const result = await sendTransaction({
              data: bytesToHex(approvePayload),
            })
            console.info('[Bridge][Approve] done', result)
          }

          setBridgeStatus('Submitting claim on Starcoin...')
          const claimArgs = [serializeU64(Date.now()), serializeU8(BRIDGE_CONFIG.evm.chainId), serializeU64(nonce)]
          console.log(11111, {
            moduleAddress: BRIDGE_CONFIG.starcoin.packageAddress,
            moduleName: 'Bridge',
            functionName: tokenConfig.claimFunction,
            typeArgs: [],
            args: claimArgs,
          })
          const claimPayload = serializeScriptFunctionPayload({
            moduleAddress: BRIDGE_CONFIG.starcoin.packageAddress,
            moduleName: 'Bridge',
            functionName: tokenConfig.claimFunction,
            typeArgs: [],
            args: claimArgs,
          })
          console.log(222222222, claimPayload, bytesToHex(claimPayload))
          await sendTransaction({
            data: bytesToHex(claimPayload),
          })

          setBridgeStatus('Bridge completed.')
          return
        }

        setBridgeStatus('Waiting for indexer finalization...')
        let nonce: number | null = null
        const pollStart = Date.now()
        const pollTimeoutMs = 10 * 60 * 1000
        let transferStatus: string | null = null
        let isFinalized = false
        const normalizedTxHash = normalizeHash(txnHash)
        let claimDelay = 0

        while (Date.now() - pollStart < pollTimeoutMs) {
          if (cancelled) return
          try {
            const list = await getTransferList({
              address: starcoinWalletInfo.address,
              page_size: 20,
              page: 1,
            })
            console.log('[Bridge] Poll page 1/?:', {
              direction,
              address: starcoinWalletInfo.address,
              total: list.pagination?.total_count,
              pages: list.pagination?.total_pages,
            })
            if (list.claim_delay_seconds != null) {
              const adjustedDelay = isDev ? Math.min(list.claim_delay_seconds, claimDelayCapSeconds) : list.claim_delay_seconds
              claimDelay = adjustedDelay
              setClaimDelaySeconds(adjustedDelay)
            }
            let matched = findMatchingTransfer(list.transfers, normalizedTxHash)
            const totalPages = list.pagination?.total_pages ?? 1
            if (!matched && totalPages > 1) {
              for (let page = 2; page <= totalPages; page += 1) {
                if (cancelled) return
                const pageList = await getTransferList({
                  address: starcoinWalletInfo.address,
                  page_size: 20,
                  page,
                })
                console.log('[Bridge] Poll page', page, '/', totalPages, 'transfers:', pageList.transfers.length)
                matched = findMatchingTransfer(pageList.transfers, normalizedTxHash)
                if (matched) break
              }
            }
            console.log('[Bridge] Match result:', matched ? { nonce: matched.nonce, status: matched.current_status } : 'NOT_FOUND')
            if (matched) {
              nonce = Number(matched.nonce)
              transferStatus = matched.current_status
              if (matched.deposit?.is_finalized) {
                console.log('[Bridge] Finalized transfer found, preparing next step')
                setBridgeStatus('Indexer finalized, preparing...')
                isFinalized = true
                break
              }
            }
          } catch (err) {
            console.debug('Transfer list not ready:', err)
          }
          await sleep(6000)
        }

        console.log('[Bridge] Poll finished:', {
          isFinalized,
          nonce,
          transferStatus,
          claimDelay,
        })
        if (!isFinalized) {
          throw new Error('Transfer not finalized yet')
        }

        // 等待倒计时结束
        if (claimDelay > 0) {
          console.log('[Bridge] Starting claim delay countdown:', claimDelay)
          setBridgeStatus(`Waiting for claim delay (${claimDelay}s)...`)
          while (claimDelay > 0) {
            if (cancelled) return
            setClaimDelaySeconds(claimDelay)
            setBridgeStatus(`Waiting for claim delay (${claimDelay}s)...`)
            console.log('[Bridge] Countdown tick:', claimDelay)
            await sleep(1000)
            claimDelay -= 1
          }
          setClaimDelaySeconds(0)
          console.log('[Bridge] Claim delay finished')
        }

        if (nonce === null || !Number.isFinite(nonce)) {
          throw new Error('Indexer did not return transfer nonce')
        }

        if (transferStatus === null) {
          const detail = await getTransferDetail(BRIDGE_CONFIG.starcoin.chainId, nonce)
          transferStatus = detail.transfer.status
        }

        if (transferStatus === 'claimed') {
          setBridgeStatus('Already claimed on Ethereum.')
          return
        }

        setBridgeStatus('Collecting validator signatures...')
        const signatures = await collectSignatures('starcoin_to_eth', txnHash, 0, { validatorCount: 3 })

        const uniqueSignatures = signatures.filter((sig, index, list) => {
          const key = sig.auth_signature.authority_pub_key
          return list.findIndex(item => item.auth_signature.authority_pub_key === key) === index
        })
        if (uniqueSignatures.length < 3) {
          throw new Error('Need signatures from 3 distinct validators.')
        }

        const first = uniqueSignatures[0]?.data
        if (!first || !('StarcoinToEthBridgeAction' in first)) {
          throw new Error('Invalid signature response')
        }

        const action = first.StarcoinToEthBridgeAction
        const event = action.starcoin_bridge_event
        const starcoinSenderAddress = (event.starcoin_bridge_address as string | undefined) ?? starcoinWalletInfo.address
        const ethRecipientAddress = (event.eth_address as string | undefined) ?? evmWalletInfo.address
        if (!starcoinSenderAddress || !ethRecipientAddress) {
          throw new Error('Signature response missing sender or recipient address')
        }
        const rawSourceChain = event.starcoin_bridge_chain_id as unknown
        const rawTargetChain = event.eth_chain_id as unknown
        const sourceChainId =
          typeof rawSourceChain === 'number' ? rawSourceChain : (CHAIN_ID_MAP[String(rawSourceChain)] ?? BRIDGE_CONFIG.starcoin.chainId)
        const targetChainId =
          typeof rawTargetChain === 'number' ? rawTargetChain : (CHAIN_ID_MAP[String(rawTargetChain)] ?? BRIDGE_CONFIG.evm.chainId)

        const starcoinAddressBytes = hexToBytes(normalizeHexLen(starcoinSenderAddress, 16))
        const recipientBytes = hexToBytes(normalizeHexLen(ethRecipientAddress, 20))
        const amount = BigInt(event.amount_starcoin_bridge_adjusted)
        const bridgeNonce = BigInt(event.nonce)
        const payload = concatBytes([
          Uint8Array.of(starcoinAddressBytes.length),
          starcoinAddressBytes,
          Uint8Array.of(targetChainId),
          Uint8Array.of(recipientBytes.length),
          recipientBytes,
          Uint8Array.of(Number(event.token_id)),
          serializeU64BE(amount),
        ])

        const signatureHexes = uniqueSignatures.map(sig => bytesToHex(base64ToBytes(sig.auth_signature.signature)))

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
        const bridgeRead = new Contract(bridgeAddress, EVM_BRIDGE_ABI, provider)

        const message = [0, 1, bridgeNonce, sourceChainId, bytesToHex(payload)]

        if (transferStatus === 'claimed') {
          setBridgeStatus('Already claimed on Ethereum.')
          return
        }

        let isApprovedOnChain = false
        try {
          const approvalTs = await bridgeRead.transferApprovals(sourceChainId, bridgeNonce)
          isApprovedOnChain = BigInt(approvalTs) > 0n
        } catch (err) {
          console.warn('[Bridge] Failed to read transferApprovals:', err)
        }

        if (transferStatus !== 'approved' && !isApprovedOnChain) {
          setBridgeStatus('Submitting approve on Ethereum...')

          const approveData = bridgeIface.encodeFunctionData('approveTransferWithSignatures', [signatureHexes, message])
          console.log('[Bridge] Approve calldata selector:', approveData.slice(0, 10))
          try {
            const approveTx = await signer.sendTransaction({ to: bridgeAddress, data: approveData })
            await approveTx.wait()
          } catch (err) {
            const messageText = err instanceof Error ? err.message : String(err)
            if (!messageText.includes('Transfer already approved')) {
              throw err
            }
            console.warn('[Bridge] Approve already done on chain, continuing to claim.')
            isApprovedOnChain = true
          }
        } else {
          setBridgeStatus('Transfer already approved, preparing claim...')
        }

        if (claimDelay > 0) {
          console.log('[Bridge] Starting claim delay countdown:', claimDelay)
          setBridgeStatus(`Waiting for claim delay (${claimDelay}s)...`)
          while (claimDelay > 0) {
            if (cancelled) return
            setClaimDelaySeconds(claimDelay)
            setBridgeStatus(`Waiting for claim delay (${claimDelay}s)...`)
            console.log('[Bridge] Countdown tick:', claimDelay)
            await sleep(1000)
            claimDelay -= 1
          }
          setClaimDelaySeconds(0)
          console.log('[Bridge] Claim delay finished')
        }
        const claimData = bridgeIface.encodeFunctionData('claimApprovedTransfer', [sourceChainId, bridgeNonce])

        const claimTx = await signer.sendTransaction({ to: bridgeAddress, data: claimData })
        console.log('[Bridge] Claim calldata selector:', claimTx)
        if (claimDelay > 0) {
          setBridgeStatus('Submitting claim on Ethereum...')

          const claimData = bridgeIface.encodeFunctionData('claimApprovedTransfer', [sourceChainId, bridgeNonce])

          console.log('[Bridge] Claim calldata selector:', claimData.slice(0, 10))
          const claimTx = await signer.sendTransaction({ to: bridgeAddress, data: claimData })
          await claimTx.wait()
        }
        setBridgeStatus('Bridge completed.')
      } catch (err) {
        console.error('Bridge error:', err)
        if (!cancelled) setBridgeError(err instanceof Error ? err.message : 'Bridge failed')
      } finally {
        if (!cancelled) setIsProcessing(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [currentCoin.name, direction, isDev, evmWalletInfo, sendTransaction, starcoinWalletInfo, txnHash])

  const statusLabel = useMemo(() => {
    if (bridgeError) return 'Failed'
    if (bridgeStatus) return bridgeStatus
    return 'Pending'
  }, [bridgeError, bridgeStatus])

  const progressValue = useMemo(() => {
    if (bridgeError) return 0
    if (!bridgeStatus) return 0
    if (bridgeStatus.includes('Waiting for indexer')) return 20
    if (bridgeStatus.includes('Collecting validator signatures')) return direction === 'starcoin_to_eth' ? 50 : 40
    if (bridgeStatus.includes('Submitting approve')) return 60
    if (bridgeStatus.includes('Submitting claim')) return 80
    if (bridgeStatus.includes('completed') || bridgeStatus.includes('Already claimed')) return 100
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

  const formatDelayTime = (seconds: number | null): string => {
    if (seconds === null) return 'calculating...'
    if (seconds <= 0) return 'Ready'
    return `${seconds} seconds`
  }

  return (
    <div className="bg-secondary grid w-full p-4">
      <div className="mx-auto grid w-full max-w-300 content-start gap-4 py-6">
        <h1 className="text-2xl font-bold">Transaction Details</h1>

        <div className="bg-accent/20 border-accent-foreground/10 grid gap-y-5 rounded-3xl border p-7.5">
          {/* {txnHash ? <div className="text-secondary-foreground w-full text-xs wrap-break-word">Tx Hash: {txnHash}</div> : null} */}
          {/* 这部分根据需要调整*/}
          <div className="flex items-center justify-between">
            <div className="grid gap-1.5">
              {/* <div className="text-secondary-foreground text-sm uppercase">SEP 30, 2024, 12:07 PM PDT</div> */}
              {/* <div className="text-primary-foreground text-3xl font-extrabold">0.01 ETH</div> */}
              <div className="text-secondary-foreground text-lg font-bold">
                {direction === 'eth_to_starcoin' ? 'From Ethereum to Starcoin' : 'From Starcoin to Ethereum'}
              </div>
            </div>
            {/*
              * 按钮三个状态：Pending, Ready to claim, Completed
              * Pending:bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground/90
              * Ready to claim: bg-accent/20 text-accent hover:bg-accent/10 hover:text-accent/90
              * Completed: bg-accent-foreground/20 text-accent-foreground hover:bg-accent-foreground/10 hover:text-accent-foreground/90
              *
              这部分根据需要调整

            */}

            <button className="bg-accent-foreground/20 text-accent-foreground hover:bg-accent-foreground/10 hover:text-accent-foreground/90 inline-flex cursor-pointer rounded-xl px-6 py-2.5 text-xl font-extrabold transition-colors duration-200">
              {statusLabel}
              {isProcessing ? <Spinner className="ms-2 h-3 w-3" /> : null}
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
                    <svg viewBox="0 0 1024 1024" className="aspect-square w-6">
                      <path
                        fill="currentColor"
                        d="M384 768c-12.8 0-21.333333-4.266667-29.866667-12.8l-213.333333-213.333333c-17.066667-17.066667-17.066667-42.666667 0-59.733334s42.666667-17.066667 59.733333 0L384 665.6 823.466667 226.133333c17.066667-17.066667 42.666667-17.066667 59.733333 0s17.066667 42.666667 0 59.733334l-469.333333 469.333333c-8.533333 8.533333-17.066667 12.8-29.866667 12.8z"
                      ></path>
                    </svg>
                  </div>
                  <span className="text-primary-foreground text-center text-sm font-semibold uppercase md:text-lg">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 提示信息 */}
          <div className="bg-secondary border-secondary-foreground/30 mt-4 flex items-center gap-x-3 rounded-xl border p-5">
            <svg viewBox="0 0 1024 1024" className="text-secondary-foreground/80 aspect-square w-6 shrink-0">
              <path
                d="M560 800l-10.464-416h-75.072L464 800h96z m-14.144-493.984c9.44-9.312 14.144-20.672 14.144-34.016 0-13.6-4.704-24.992-14.144-34.208A46.784 46.784 0 0 0 512 224c-13.12 0-24.448 4.608-33.856 13.792A45.856 45.856 0 0 0 464 272c0 13.344 4.704 24.704 14.144 34.016 9.408 9.312 20.704 13.984 33.856 13.984 13.12 0 24.448-4.672 33.856-13.984zM512 32C246.912 32 32 246.912 32 512c0 265.088 214.912 480 480 480 265.088 0 480-214.912 480-480 0-265.088-214.912-480-480-480z m0 64c229.76 0 416 186.24 416 416s-186.24 416-416 416S96 741.76 96 512 282.24 96 512 96z"
                fill="currentColor"
              ></path>
            </svg>
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="text-primary-foreground text-lg font-bold">
                {direction === 'eth_to_starcoin' ? 'Ethereum' : 'Starcoin'} may take {formatDelayTime(claimDelaySeconds)} or more
              </div>
              {bridgeStatus ? <div className="text-accent-foreground w-full text-sm">{bridgeStatus}</div> : null}
              {bridgeError ? <div className="text-secondary-foreground w-full text-sm">{bridgeError}</div> : null}
            </div>
          </div>
          {/*卡片*/}
          <div className="grid gap-6 md:grid-cols-2">
            {/* 左侧卡片 */}
            <div className="bg-secondary/50 grid content-start overflow-hidden rounded-xl">
              <div className="bg-accent-foreground/10 flex items-center justify-between gap-x-3 p-5">
                <div className="text-primary-foreground text-lg font-bold wrap-break-word">
                  {direction === 'eth_to_starcoin' ? 'Ethereum' : 'Starcoin'}
                </div>
                <img width={32} height={32} src={direction === 'eth_to_starcoin' ? ethIcon : sepoliaEthIcon} />
              </div>
              <div className="grid gap-3 p-5">
                <div className="flex items-center justify-between gap-x-3">
                  <div className="text-md text-secondary-foreground font-medium wrap-break-word">Originating wallet</div>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {direction === 'eth_to_starcoin' ? evmWalletInfo?.address : starcoinWalletInfo?.address}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-x-3">
                  <div className="text-md text-secondary-foreground font-medium wrap-break-word">Gas Fee</div>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">0.00000389 ETH</div>
                </div>
                <div className="mt-4 flex flex-row items-center justify-around">
                  <a
                    className="font-inter text-accent-foreground hover:text-accent-foreground/80 flex items-center text-lg font-semibold uppercase transition-colors duration-200"
                    href={`https://suivision.xyz/txblock/${txnHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Explorer
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                    >
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            {/* 右侧卡片 */}
            <div className="bg-secondary/50 grid content-start overflow-hidden rounded-xl">
              <div className="bg-accent-foreground/10 flex items-center justify-between gap-x-3 p-5">
                <div className="text-primary-foreground text-lg font-bold wrap-break-word">
                  {direction === 'eth_to_starcoin' ? 'Starcoin' : 'Ethereum'}
                </div>
                <img width={32} height={32} src={direction === 'eth_to_starcoin' ? sepoliaEthIcon : ethIcon} />
              </div>
              <div className="grid gap-3 p-5">
                <div className="flex items-center justify-between gap-x-3">
                  <div className="text-md text-secondary-foreground font-medium wrap-break-word">Destination wallet</div>
                  <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">
                    {direction === 'eth_to_starcoin' ? starcoinWalletInfo?.address : evmWalletInfo?.address}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-x-3">
                  <div className="text-md text-secondary-foreground font-medium wrap-break-word">Gas Fee</div>
                  <div className="flex items-center gap-1">
                    <div className="font-inter text-md text-primary-foreground font-medium wrap-break-word">pending</div>
                    <Spinner className="h-3 w-3" />
                  </div>
                </div>
                <div className="mt-4 hidden flex-row items-center justify-around">
                  <a
                    className="font-inter text-accent-foreground hover:text-accent-foreground/80 flex items-center text-lg font-semibold uppercase transition-colors duration-200"
                    href={`https://suivision.xyz/txblock/${txnHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Explorer
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                    >
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
