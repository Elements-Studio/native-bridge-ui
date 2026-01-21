import ethIcon from '@/assets/img/eth.svg'
import sepoliaEthIcon from '@/assets/img/sepolia_eth.svg'
import { Spinner } from '@/components/ui/spinner'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { BRIDGE_ABI, BRIDGE_CONFIG, normalizeHash, normalizeHex } from '@/lib/bridgeConfig'
import { getMetaMask } from '@/lib/evmProvider'
import { collectSignatures, getTransferDetail, getTransferList, type SignatureResponse } from '@/services'
import { useGlobalStore } from '@/stores/globalStore'
import { BrowserProvider, Interface } from 'ethers'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function waitForReceipt(provider: BrowserProvider, txHash: string, timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.getTransactionReceipt(txHash)
    if (receipt) return receipt
    await sleep(6000)
  }
  return null
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
      setBridgeStatus('Waiting for Ethereum receipt...')
      setIsProcessing(true)
      try {
        const mm = await getMetaMask()
        if (!mm) throw new Error('MetaMask not detected')

        await mm.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BRIDGE_CONFIG.evm.chainIdHex }],
        })

        const provider = new BrowserProvider(mm)
        const receiptTimeoutMs = 10 * 60 * 1000
        const receipt = await waitForReceipt(provider, txnHash, receiptTimeoutMs)
        if (!receipt) throw new Error('Failed to fetch deposit receipt')

        const bridgeAddress = BRIDGE_CONFIG.evm.bridgeAddress.toLowerCase()
        const iface = new Interface(BRIDGE_ABI)
        const event = iface.getEvent('TokensDeposited')
        const eventTopic = event?.topicHash
        const receiptLogs = receipt.logs.filter(log => log.address?.toLowerCase() === bridgeAddress)
        const matchedLogs = eventTopic ? receiptLogs.filter(log => log.topics?.[0] === eventTopic) : receiptLogs
        const parsedLog = matchedLogs
          .map(log => {
            try {
              return iface.parseLog(log)
            } catch {
              return null
            }
          })
          .find(log => log?.name === 'TokensDeposited')

        let nonce: number | null = null
        if (parsedLog) {
          nonce = Number(parsedLog.args?.nonce ?? 0)
        }

        if (!Number.isFinite(nonce) || nonce === null) {
          setBridgeStatus('Resolving nonce from indexer...')
          const normalizedTxHash = normalizeHash(txnHash)
          const listStart = Date.now()
          const listTimeoutMs = 10 * 60 * 1000
          while (Date.now() - listStart < listTimeoutMs) {
            if (cancelled) return
            const list = await getTransferList({
              address: evmWalletInfo.address,
              chain_id: BRIDGE_CONFIG.evm.chainId,
              status: 'deposited',
              finalized_only: true,
              page_size: 20,
            })
            const matched = list.transfers.find(t => normalizeHash(t.txn_hash ?? '') === normalizedTxHash)
            if (matched) {
              nonce = Number(matched.nonce)
              break
            }
            await sleep(6000)
          }
        }

        if (nonce === null || !Number.isFinite(nonce)) {
          throw new Error(`TokensDeposited event not found, txHash=${txnHash}`)
        }

        setBridgeStatus('Waiting for indexer finalization...')
        const pollStart = Date.now()
        const pollTimeoutMs = 10 * 60 * 1000
        let transferStatus: string | null = null
        let isFinalized = false

        while (Date.now() - pollStart < pollTimeoutMs) {
          if (cancelled) return
          try {
            const detail = await getTransferDetail(BRIDGE_CONFIG.evm.chainId, nonce)
            transferStatus = detail.transfer.status
            if (detail.transfer.is_finalized) {
              isFinalized = true
              break
            }
          } catch (err) {
            console.debug('Transfer detail not ready:', err)
          }
          await sleep(6000)
        }

        if (!isFinalized) {
          throw new Error('Transfer not finalized yet')
        }

        if (transferStatus === null) {
          throw new Error('Indexer did not return transfer details')
        }

        if (transferStatus === 'claimed') {
          setBridgeStatus('Already claimed on Starcoin.')
          return
        }

        let signatures: SignatureResponse[] = []
        if (transferStatus !== 'approved') {
          setBridgeStatus('Collecting validator signatures...')
          signatures = await collectSignatures('eth_to_starcoin', txnHash, 0)
        }

        if (transferStatus !== 'approved') {
          setBridgeStatus('Submitting approve on Starcoin...')
          const first = signatures[0]?.data
          if (!first || !('EthToStarcoinBridgeAction' in first)) {
            throw new Error('Invalid signature response')
          }
          const action = first.EthToStarcoinBridgeAction
          const event = action.eth_bridge_event

          const sigBytes = signatures.map(sig => normalizeHex(sig.auth_signature.signature))
          const approveFn =
            sigBytes.length >= 3
              ? 'approve_bridge_token_transfer_three'
              : sigBytes.length === 2
                ? 'approve_bridge_token_transfer_two'
                : 'approve_bridge_token_transfer_single'

          const approveArgs = [
            BRIDGE_CONFIG.evm.chainId,
            String(event.nonce),
            normalizeHex(event.eth_sender_address, 20),
            BRIDGE_CONFIG.evm.destinationChainId,
            normalizeHex(event.starcoin_bridge_recipient_address, 16),
            event.token_id,
            String(event.starcoin_bridge_adjusted_amount),
            ...sigBytes.slice(0, 3),
          ]

          await sendTransaction({
            payload: {
              type: 'script_function',
              function_id: `${BRIDGE_CONFIG.starcoin.packageAddress}::Bridge::${approveFn}`,
              args: approveArgs,
            },
          })
        }

        setBridgeStatus('Submitting claim on Starcoin...')
        await sendTransaction({
          payload: {
            type: 'script_function',
            function_id: `${BRIDGE_CONFIG.starcoin.packageAddress}::Bridge::${tokenConfig.claimFunction}`,
            args: [String(Date.now()), BRIDGE_CONFIG.evm.chainId, String(nonce)],
          },
        })

        setBridgeStatus('Bridge completed.')
      } catch (err) {
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
    if (bridgeStatus) return 'Processing'
    return 'Pending'
  }, [bridgeError, bridgeStatus])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-4xl bg-gray-700">
      <div className="mx-[15%] my-20 flex w-[90%] flex-col items-center justify-center gap-6 md:w-177 xl:mx-[10%]">
        <div className="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
          <div className="text-2xl font-semibold wrap-break-word">Transaction details</div>
        </div>
        {txnHash ? <div className="w-full text-xs wrap-break-word text-gray-200">Tx Hash: {txnHash}</div> : null}
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
