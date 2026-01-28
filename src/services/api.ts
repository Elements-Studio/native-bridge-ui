import env from '@/env'
import axios, { AxiosError, type AxiosInstance } from 'axios'
import idmp from 'idmp'
import { parse, stringify } from 'json-web3'
import { sampleSize } from 'lodash-es'
import type {
  EstimateDirection,
  EstimateFeesResponse,
  HealthResponse,
  QuotaResponse,
  SignatureResponse,
  TransferDetailResponse,
  TransferListParams,
  TransferListResponse,
} from './types'

const client: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  transformResponse: data => {
    try {
      return parse(data)
    } catch {
      return data
    }
  },
})

const handleError = (error: AxiosError) => {
  if (error.response) {
    const responseData = typeof error.response.data === 'string' ? parse(error.response.data) : error.response.data
    console.error('API Error:', error.response.status, responseData)
    throw new Error(`API Error: ${error.response.status} - ${stringify(responseData)}`)
  } else if (error.request) {
    console.error('Network Error:', error.message)
    throw new Error('Network Error: No response from server')
  } else {
    console.error('Error:', error.message)
    throw error
  }
}

type CommitteesResponse = {
  signs: string[]
}

async function getCommittees(): Promise<CommitteesResponse> {
  return {
    signs: env.apis.committees.signs,
  }
}

// ========== Health Check ==========

async function _getHealth(): Promise<HealthResponse> {
  try {
    const response = await client.get<HealthResponse>('/health')
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

export async function getHealth(): Promise<HealthResponse> {
  const key = `health`
  return idmp(key, () => _getHealth(), { maxRetry: 2 })
}

// ========== Transfer Detail ==========

export async function getTransferDetail(chainId: number, nonce: number): Promise<TransferDetailResponse> {
  try {
    const response = await client.get<TransferDetailResponse>(`${env.apis['/transfers']}/${chainId}/${nonce}`)
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

// ========== Transfer List ==========

export async function getTransferList(params: TransferListParams): Promise<TransferListResponse> {
  try {
    const response = await client.get<TransferListResponse>(env.apis['/transfers'], { params })
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

// ========== Quota ==========

async function _getQuota(): Promise<QuotaResponse> {
  try {
    const response = await client.get<QuotaResponse>('/quota')
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

export async function getQuota(): Promise<QuotaResponse> {
  const key = `quota`
  return idmp(key, () => _getQuota(), { maxRetry: 2 })
}

// ========== Estimate Fees ==========

async function _getEstimateFees(direction: EstimateDirection): Promise<EstimateFeesResponse> {
  try {
    const response = await client.get<EstimateFeesResponse>(env.apis['/estimate_fees'], { params: { direction } })
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

export async function getEstimateFees(direction: EstimateDirection): Promise<EstimateFeesResponse> {
  const key = `estimate_fees: ${stringify({ params: { direction } })}`
  return idmp(key, () => _getEstimateFees(direction), { maxRetry: 2 })
}

// ========== Validator Signatures ==========

async function _getStarcoinToEthSignature(
  txHash: string,
  eventIndex: number,
  _validatorIndex: number,
  signBaseUrl: string,
): Promise<SignatureResponse> {
  try {
    const cleanHash = txHash.replace(/^0x/, '')
    const url = `${signBaseUrl}/bridge_tx/starcoin/eth/${cleanHash}/${eventIndex}`

    const response = await axios.get<SignatureResponse>(url)
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

export async function getStarcoinToEthSignature(
  txHash: string,
  eventIndex = 0,
  validatorIndex = 0,
  signBaseUrl: string,
): Promise<SignatureResponse> {
  const key = `starcoin_to_eth_signature: ${stringify({ txHash, eventIndex, validatorIndex, signBaseUrl })}`
  return idmp(key, () => _getStarcoinToEthSignature(txHash, eventIndex, validatorIndex, signBaseUrl), { maxRetry: 2 })
}

async function _getEthToStarcoinSignature(
  txHash: string,
  eventIndex: number,
  _validatorIndex: number,
  signBaseUrl: string,
): Promise<SignatureResponse> {
  try {
    const cleanHash = txHash.replace(/^0x/, '')
    const url = `${signBaseUrl}/bridge_tx/eth/starcoin/${cleanHash}/${eventIndex}`
    const response = await (signBaseUrl ? axios.get<SignatureResponse>(url) : client.get<SignatureResponse>(url))
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

export async function getEthToStarcoinSignature(
  txHash: string,
  eventIndex = 0,
  validatorIndex = 0,
  signBaseUrl: string,
): Promise<SignatureResponse> {
  const key = `eth_to_starcoin_signature: ${stringify({ txHash, eventIndex, validatorIndex, signBaseUrl })}`
  return idmp(key, () => _getEthToStarcoinSignature(txHash, eventIndex, validatorIndex, signBaseUrl), { maxRetry: 2 })
}

// ========== Collect Signatures (并发收集多个 Validator) ==========

const DEFAULT_VALIDATOR_COUNT = 3

export async function collectSignatures(
  direction: 'starcoin_to_eth' | 'eth_to_starcoin',
  txHash: string,
  eventIndex = 0,
  opts?: { validatorCount?: number; quorumStake?: number; validatorStakes?: Record<string, number> },
): Promise<SignatureResponse[]> {
  const requestFn = direction === 'starcoin_to_eth' ? getStarcoinToEthSignature : getEthToStarcoinSignature
  const validatorCount = opts?.validatorCount ?? DEFAULT_VALIDATOR_COUNT

  const committees = await getCommittees()
  const candidates = sampleSize(committees.signs, Math.min(validatorCount, committees.signs.length))

  if (candidates.length < validatorCount) {
    throw new Error(`Not enough committee sign endpoints. Need ${validatorCount}, got ${candidates.length}`)
  }

  // 并发请求多个 committee 签名服务
  const results = await Promise.allSettled(
    candidates.map((signBaseUrl, i) =>
      requestFn(txHash, eventIndex, i, signBaseUrl).catch(err => {
        console.warn(`Committee ${signBaseUrl} failed:`, err.message)
        throw err
      }),
    ),
  )

  const signatures: SignatureResponse[] = []
  let totalStake = 0
  let hasStakeInfo = false
  // 收集成功的签名（不提前 break，确保拿到完整数量）
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      const pubkey = result.value?.auth_signature?.authority_pub_key
      console.info(`[ValidatorSignature] index=${signatures.length} pubkey=${pubkey ?? 'unknown'}`)
      signatures.push(result.value)

      const signBaseUrl = candidates[i]
      const stakeFromConfig = signBaseUrl ? opts?.validatorStakes?.[signBaseUrl] : undefined
      const stakeFromPayload = (result.value as SignatureResponse & { stake?: number }).stake
      const stakeFromAuth = (result.value?.auth_signature as { stake?: number } | undefined)?.stake
      const stake = stakeFromConfig ?? stakeFromPayload ?? stakeFromAuth
      if (typeof stake === 'number' && Number.isFinite(stake)) {
        totalStake += stake
        hasStakeInfo = true
      }
    }
  }

  if (signatures.length < validatorCount) {
    throw new Error(`Failed to collect enough signatures. Got ${signatures.length}, need ${validatorCount}`)
  }

  if (opts?.quorumStake !== undefined && hasStakeInfo && totalStake < opts.quorumStake) {
    throw new Error(`Validator quorum not reached. Stake ${totalStake} < ${opts.quorumStake}`)
  }

  return signatures
}
