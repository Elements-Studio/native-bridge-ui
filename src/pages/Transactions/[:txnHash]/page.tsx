import ethIcon from '@/assets/img/eth.svg'
import sepoliaEthIcon from '@/assets/img/sepolia_eth.svg'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { BRIDGE_ABI, BRIDGE_CONFIG, normalizeHash, normalizeHex } from '@/lib/bridgeConfig'
import { getMetaMask } from '@/lib/evmProvider'
import { bytesToHex, hexToBytes, serializeBytes, serializeScriptFunctionPayload, serializeU64, serializeU8 } from '@/lib/starcoinBcs'
import { collectSignatures, getTransferDetail, getTransferList, type SignatureResponse } from '@/services'
import { useGlobalStore } from '@/stores/globalStore'
import { BrowserProvider, Interface } from 'ethers'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
  const { currentCoin, evmWalletInfo, starcoinWalletInfo } = useGlobalStore()
  const { sendTransaction } = useStarcoinTools()
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
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
    if (!tokenConfig) {
      setBridgeError('Selected token is not supported for ETH → Starcoin.')
      return
    }

    if (startedRef.current === txnHash) return
    startedRef.current = txnHash
    let cancelled = false

    const run = async () => {
      setBridgeError(null)
      setBridgeStatus('Waiting for indexer finalization...')
      setIsProcessing(true)
      try {
        let nonce: number | null = null
        const pollStart = Date.now()
        const pollTimeoutMs = 10 * 60 * 1000
        let transferStatus: string | null = null
        let isFinalized = false
        const normalizedTxHash = normalizeHash(txnHash)

        while (Date.now() - pollStart < pollTimeoutMs) {
          if (cancelled) return
          try {
            const list = await getTransferList({
              address: evmWalletInfo.address,
              chain_id: BRIDGE_CONFIG.evm.chainId,
              page_size: 20,
            })
            const matched = list.transfers.find(t => normalizeHash(t.txn_hash ?? '') === normalizedTxHash)
            if (matched) {
              nonce = Number(matched.nonce)
              transferStatus = matched.status
              if (matched.is_finalized) {
                isFinalized = true
                break
              }
            }
          } catch (err) {
            console.debug('Transfer list not ready:', err)
          }
          await sleep(6000)
        }

        if (!isFinalized) {
          throw new Error('Transfer not finalized yet')
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
          setBridgeStatus('Collecting validator signatures...')
          const eventIndex = await getEthEventIndex(txnHash)
          signatures = await collectSignatures('eth_to_starcoin', txnHash, eventIndex, {
            validatorCount: 3,
            quorumStake: 3334,
          })
        }
        if (transferStatus !== 'approved') {
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
          const ethSenderAddress = getEthSenderAddress(event as Record<string, unknown>) ?? evmWalletInfo.address
          const starcoinRecipientAddress = getStarcoinRecipientAddress(event as Record<string, unknown>) ?? starcoinWalletInfo.address
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

          await sendTransaction({
            data: bytesToHex(approvePayload),
          })
        }

        setBridgeStatus('Submitting claim on Starcoin...')
        const claimArgs = [serializeU64(Date.now()), serializeU8(BRIDGE_CONFIG.evm.chainId), serializeU64(nonce)]
        const claimPayload = serializeScriptFunctionPayload({
          moduleAddress: BRIDGE_CONFIG.starcoin.packageAddress,
          moduleName: 'Bridge',
          functionName: tokenConfig.claimFunction,
          typeArgs: [],
          args: claimArgs,
        })
        await sendTransaction({
          data: bytesToHex(claimPayload),
        })

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
  }, [currentCoin.name, evmWalletInfo, sendTransaction, starcoinWalletInfo, txnHash])

  const statusLabel = useMemo(() => {
    if (bridgeError) return 'Failed'
    if (bridgeStatus) return bridgeStatus
    return 'Pending'
  }, [bridgeError, bridgeStatus])

  const progressValue = useMemo(() => {
    if (bridgeError) return 100
    if (!bridgeStatus) return 0
    if (bridgeStatus.includes('Waiting for indexer')) return 20
    if (bridgeStatus.includes('Collecting validator signatures')) return 40
    if (bridgeStatus.includes('Submitting approve')) return 60
    if (bridgeStatus.includes('Submitting claim')) return 80
    if (bridgeStatus.includes('completed') || bridgeStatus.includes('Already claimed')) return 100
    return 0
  }, [bridgeError, bridgeStatus])

  const progressSteps = [
    { label: 'Waiting for finalization', value: 20 },
    { label: 'Collecting signatures', value: 40 },
    { label: 'Approving transfer', value: 60 },
    { label: 'Claiming tokens', value: 80 },
    { label: 'Completed', value: 100 },
  ]

  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-4xl bg-gray-700">
      <div className="mx-[15%] my-20 flex w-[90%] flex-col items-center justify-center gap-6 md:w-177 xl:mx-[10%]">
        <div className="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
          <div className="text-2xl font-semibold wrap-break-word">Transaction details</div>
        </div>
        {txnHash ? <div className="w-full text-xs wrap-break-word text-gray-200">Tx Hash: {txnHash}</div> : null}

        {/* Progress Bar Section */}
        <div className="w-full space-y-4 rounded-2xl bg-gray-600 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-100">{bridgeError ? 'Transaction Failed' : statusLabel}</span>
            <span className="text-sm font-semibold text-gray-100">{progressValue}%</span>
          </div>

          <Progress value={progressValue} className={bridgeError ? 'bg-gray-600' : ''} />

          {/* Progress Steps */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {progressSteps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={`mb-1 h-2 w-2 rounded-full transition-colors ${
                    progressValue >= step.value ? (bridgeError && progressValue === 100 ? 'bg-red-500' : 'bg-purple-500') : 'bg-gray-500'
                  }`}
                />
                <span className="text-2xs text-center text-gray-300">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {bridgeStatus ? <div className="w-full text-xs text-gray-200">{bridgeStatus}</div> : null}
        {bridgeError ? <div className="w-full text-xs text-red-300">{bridgeError}</div> : null}
        <div className="w-full rounded-3xl bg-gray-500 backdrop-blur-xl">
          <div className="flex flex-row items-center justify-between space-y-1.5 p-6">
            <div className="flex flex-col gap-2">
              <div className="flex md:hidden">
                <div className="focus:ring-ring inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none">
                  {statusLabel}
                  {isProcessing ? <Spinner className="ms-2 h-3 w-3" /> : null}
                </div>
              </div>
            </div>
            <div className="items-center justify-center gap-4">
              <div className="hidden items-center justify-center gap-4 md:flex">
                <div className="focus:ring-ring inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none">
                  {statusLabel}
                  {isProcessing ? <Spinner className="ms-2 h-3 w-3" /> : null}
                </div>
              </div>
            </div>
          </div>
          <div data-state="open" id="radix-:r1i:">
            <div className="">
              <div className="flex items-center justify-center px-6 pb-6">
                <div className="flex w-full flex-col gap-6">
                  <div className="flex w-full flex-col justify-between gap-4 md:flex-row">
                    <div className="flex flex-1 flex-col rounded-3xl bg-gray-400 pb-4">
                      <div className="flex items-center justify-between gap-2 rounded-t-3xl p-4">
                        <div className="text-sm font-medium wrap-break-word"></div>
                        <img width={24} height={24} src={ethIcon} />
                      </div>
                      <div className="flex flex-col gap-2 p-4">
                        <div className="flex flex-row items-center justify-between">
                          <div className="text-sm font-normal wrap-break-word">Originating wallet</div>
                          <div className="font-inter text-sm leading-4 font-normal wrap-break-word"></div>
                        </div>
                        <div className="flex flex-row items-center justify-between">
                          <div className="font-inter text-sm leading-4 font-normal wrap-break-word">Gas Fee</div>
                          <div className="font-inter text-sm leading-4 font-normal wrap-break-word">-</div>
                        </div>
                      </div>
                      <div className="flex flex-row items-center justify-around">
                        <a
                          className="font-inter text-2xs text-accent-content flex items-center leading-4 font-semibold uppercase"
                          href="https://suivision.xyz/txblock/0xd3d404a473e024b8a37ec1df93ea5a57f3d36ed96117bdeb625cdae0ff51f562"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View on Explorer
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            className="h-3 w-3"
                          >
                            <path d="M5 12h14"></path>
                            <path d="m12 5 7 7-7 7"></path>
                          </svg>
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col rounded-3xl bg-gray-400 pb-3">
                      <div className="flex items-center justify-between gap-2 rounded-t-3xl p-4">
                        <div className="text-sm font-medium wrap-break-word"></div>
                        <img width={24} height={24} src={sepoliaEthIcon} />
                      </div>
                      <div className="flex flex-col gap-2 p-4">
                        <div className="flex flex-row items-center justify-between">
                          <div className="text-sm font-normal wrap-break-word">Destination wallet</div>
                          <div className="font-inter text-sm leading-4 font-normal wrap-break-word"></div>
                        </div>
                        <div className="flex flex-row items-center justify-between">
                          <div className="font-inter text-sm leading-4 font-normal wrap-break-word">Gas Fee</div>
                          <div className="flex items-center gap-1">
                            <div className="font-inter text-sm leading-4 font-normal wrap-break-word">pending</div>
                            <Spinner className="h-3 w-3" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
