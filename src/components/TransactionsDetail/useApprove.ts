import useStarcoinTools from '@/hooks/useStarcoinTools'
import { BRIDGE_ABI, BRIDGE_CONFIG, normalizeHex } from '@/lib/bridgeConfig'
import { getMetaMask } from '@/lib/evmProvider'
import { bytesToHex, hexToBytes, serializeBytes, serializeScriptFunctionPayload, serializeU64, serializeU8 } from '@/lib/starcoinBcs'
import { base64ToBytes, concatBytes, normalizeHexLen, serializeU64BE, sleep } from '@/lib/utils'
import type { SignatureResponse } from '@/services'
import { useGlobalStore } from '@/stores/globalStore'
import { BrowserProvider, Contract, Interface, getAddress } from 'ethers'
import { useCallback, useRef } from 'react'
import { BridgeStatus, useTransactionsDetailStore } from './store'

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

function getStarcoinRecipientAddress(event: Record<string, unknown>) {
  return (
    (event.starcoin_bridge_recipient_address as string | undefined) ??
    (event.starcoin_bridge_address as string | undefined) ??
    (event.starcoinBridgeRecipientAddress as string | undefined)
  )
}

export interface ApproveParams {
  direction: 'eth_to_starcoin' | 'starcoin_to_eth'
  signatures: SignatureResponse[]
  ethSenderAddress?: string
}

/**
 * 提交 approve 到 Starcoin 链
 */
async function submitApproveToStarcoin(
  signatures: SignatureResponse[],
  ethSenderAddress: string | undefined,
  starcoinRecipientAddress: string | undefined,
  sendTransaction: (params: { data: string; gas?: string; gasPrice?: string }) => Promise<unknown>,
  gasParams?: { gas?: string; gasPrice?: string } | null,
) {
  console.log('[Bridge][Approve] Start submitting approve on Starcoin...')

  const first = signatures[0]?.data
  if (!first || !('EthToStarcoinBridgeAction' in first)) {
    throw new Error('Invalid signature response')
  }
  const action = first.EthToStarcoinBridgeAction
  const event = action.eth_bridge_event

  const senderAddr = (event.eth_sender_address as string | undefined) ?? ethSenderAddress
  const recipientAddr = getStarcoinRecipientAddress(event as unknown as Record<string, unknown>) ?? starcoinRecipientAddress

  if (!senderAddr || !recipientAddr) {
    throw new Error('Signature response missing sender or recipient address')
  }

  const sigBytes = signatures.map(sig => base64ToBytes(sig.auth_signature.signature))
  const approveFn = 'approve_bridge_token_transfer_three'

  const senderAddressBytes = hexToBytes(normalizeHex(senderAddr, 20))
  const recipientAddressBytes = hexToBytes(normalizeHex(recipientAddr, 16))
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
    gas: gasParams?.gas,
    gasPrice: gasParams?.gasPrice,
  })
  console.log('[Bridge][Approve] Done on Starcoin:', result)
}

/**
 * 提交 approve 到 Ethereum 链
 */
async function submitApproveToEthereum(
  signatures: SignatureResponse[],
  starcoinSenderAddress: string | undefined,
  ethRecipientAddress: string | undefined,
) {
  console.log('[Bridge][Approve] Start submitting approve on Ethereum...')

  const first = signatures[0]?.data
  if (!first || !('StarcoinToEthBridgeAction' in first)) {
    throw new Error('Invalid signature response')
  }

  const action = first.StarcoinToEthBridgeAction
  const event = action.starcoin_bridge_event
  const senderAddr = (event.starcoin_bridge_address as string | undefined) ?? starcoinSenderAddress
  const recipientAddr = (event.eth_address as string | undefined) ?? ethRecipientAddress
  if (!senderAddr || !recipientAddr) {
    throw new Error('Signature response missing sender or recipient address')
  }

  const rawSourceChain = event.starcoin_bridge_chain_id as unknown
  const rawTargetChain = event.eth_chain_id as unknown
  const sourceChainId =
    typeof rawSourceChain === 'number' ? rawSourceChain : (CHAIN_ID_MAP[String(rawSourceChain)] ?? BRIDGE_CONFIG.starcoin.chainId)
  const targetChainId =
    typeof rawTargetChain === 'number' ? rawTargetChain : (CHAIN_ID_MAP[String(rawTargetChain)] ?? BRIDGE_CONFIG.evm.chainId)

  const starcoinAddressBytes = hexToBytes(normalizeHexLen(senderAddr, 16))
  const recipientBytes = hexToBytes(normalizeHexLen(recipientAddr, 20))
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

  const signatureHexes = signatures.map(sig => bytesToHex(base64ToBytes(sig.auth_signature.signature)))

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

  // Check if already approved on-chain
  let isApprovedOnChain = false
  try {
    const approvalTs = await bridgeRead.transferApprovals(sourceChainId, bridgeNonce)
    isApprovedOnChain = BigInt(approvalTs) > 0n
    console.log('[Bridge approvalTs]', approvalTs)
  } catch (err) {
    console.error('[Bridge] Failed to read transferApprovals:', err)
  }

  if (!isApprovedOnChain) {
    const approveData = bridgeIface.encodeFunctionData('approveTransferWithSignatures', [signatureHexes, message])
    console.log('[Bridge] Approve calldata selector:', approveData.slice(0, 10))
    try {
      const approveTx = await signer.sendTransaction({ to: bridgeAddress, data: approveData })
      await approveTx.wait()
      console.log('[Bridge][Approve] Done on Ethereum')
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err)
      if (!messageText.includes('Transfer already approved')) {
        throw err
      }
      console.warn('[Bridge] Approve already done on chain, continuing.')
    }
  } else {
    console.log('[Bridge] Transfer already approved on Ethereum')
  }
}

/**
 * useApprove hook - 处理 approve 交易的提交
 */
export function useApprove() {
  const approvingRef = useRef(false)

  const direction = useTransactionsDetailStore(state => state.direction)
  const bridgeStatus = useTransactionsDetailStore(state => state.bridgeStatus)
  const signatures = useTransactionsDetailStore(state => state.signatures)
  const setBridgeStatus = useTransactionsDetailStore(state => state.setBridgeStatus)
  const setBridgeError = useTransactionsDetailStore(state => state.setBridgeError)
  const starcoinGasParams = useTransactionsDetailStore(state => state.starcoinGasParams)

  const evmWalletInfo = useGlobalStore(state => state.evmWalletInfo)
  const starcoinWalletInfo = useGlobalStore(state => state.starcoinWalletInfo)

  const { sendTransaction } = useStarcoinTools()

  const submitApprove = useCallback(async () => {
    if (bridgeStatus !== BridgeStatus.CollectingValidatorSignatures) return
    if (signatures.length < 3) return
    if (approvingRef.current) return
    await sleep(3000)
    approvingRef.current = true
    setBridgeStatus(BridgeStatus.SubmittingApprove)

    try {
      const uniqueSignatures = signatures.filter((sig, index, list) => {
        const key = sig.auth_signature.authority_pub_key
        return list.findIndex(item => item.auth_signature.authority_pub_key === key) === index
      })
      if (uniqueSignatures.length < 3) {
        throw new Error('Need signatures from 3 distinct validators.')
      }

      if (direction === 'eth_to_starcoin') {
        await submitApproveToStarcoin(
          uniqueSignatures,
          evmWalletInfo?.address,
          starcoinWalletInfo?.address,
          sendTransaction,
          starcoinGasParams,
        )
      } else {
        await submitApproveToEthereum(uniqueSignatures, starcoinWalletInfo?.address, evmWalletInfo?.address)
      }
    } catch (err) {
      console.error('[Bridge][Approve] Failed:', err)
      setBridgeError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      approvingRef.current = false
    }
  }, [
    bridgeStatus,
    direction,
    signatures,
    evmWalletInfo?.address,
    starcoinWalletInfo?.address,
    starcoinGasParams,
    sendTransaction,
    setBridgeStatus,
    setBridgeError,
  ])

  return {
    submitApprove,
    isApproving: approvingRef.current,
  }
}
