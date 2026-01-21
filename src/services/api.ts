import axios, { AxiosError, type AxiosInstance } from 'axios'
import idmp from 'idmp'
import { parse, stringify } from 'json-web3'
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

const BASE_URL = '/api'

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
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
    const response = await client.get<TransferDetailResponse>(`/transfers/${chainId}/${nonce}`)
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

// ========== Transfer List ==========

export async function getTransferList(params: TransferListParams): Promise<TransferListResponse> {
  try {
    const response = await client.get<TransferListResponse>('/transfers', { params })
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
    const response = await client.get<EstimateFeesResponse>('/estimate_fees', { params: { direction } })
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

async function _getStarcoinToEthSignature(txHash: string, eventIndex: number, validatorIndex: number): Promise<SignatureResponse> {
  try {
    const cleanHash = txHash.replace(/^0x/, '')
    const response = await client.get<SignatureResponse>(`/sign/bridge_tx/starcoin/eth/${cleanHash}/${eventIndex}`, {
      headers: {
        'X-Validator-Index': validatorIndex.toString(),
      },
    })
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

export async function getStarcoinToEthSignature(txHash: string, eventIndex = 0, validatorIndex = 0): Promise<SignatureResponse> {
  const key = `starcoin_to_eth_signature: ${stringify({ txHash, eventIndex, validatorIndex })}`
  return idmp(key, () => _getStarcoinToEthSignature(txHash, eventIndex, validatorIndex), { maxRetry: 2 })
}

async function _getEthToStarcoinSignature(txHash: string, eventIndex: number, validatorIndex: number): Promise<SignatureResponse> {
  try {
    const cleanHash = txHash.replace(/^0x/, '')
    const response = await client.get<SignatureResponse>(`/sign/bridge_tx/eth/starcoin/${cleanHash}/${eventIndex}`, {
      headers: {
        'X-Validator-Index': validatorIndex.toString(),
      },
    })
    return response.data
  } catch (error) {
    return handleError(error as AxiosError)
  }
}

export async function getEthToStarcoinSignature(txHash: string, eventIndex = 0, validatorIndex = 0): Promise<SignatureResponse> {
  const key = `eth_to_starcoin_signature: ${stringify({ txHash, eventIndex, validatorIndex })}`
  return idmp(key, () => _getEthToStarcoinSignature(txHash, eventIndex, validatorIndex), { maxRetry: 2 })
}

// ========== Collect Signatures (并发收集多个 Validator) ==========

const DEFAULT_VALIDATOR_COUNT = 2
const DEFAULT_QUORUM_STAKE = 3334
const DEFAULT_STAKE_PER_VALIDATOR = 0

export async function collectSignatures(
  direction: 'starcoin_to_eth' | 'eth_to_starcoin',
  txHash: string,
  eventIndex = 0,
  opts?: { validatorCount?: number; quorumStake?: number; stakePerValidator?: number },
): Promise<SignatureResponse[]> {
  const requestFn = direction === 'starcoin_to_eth' ? getStarcoinToEthSignature : getEthToStarcoinSignature
  const validatorCount = opts?.validatorCount ?? DEFAULT_VALIDATOR_COUNT
  const quorumStake = opts?.quorumStake ?? DEFAULT_QUORUM_STAKE
  const stakePerValidator = opts?.stakePerValidator ?? DEFAULT_STAKE_PER_VALIDATOR

  // 并发请求所有 Validator（通过索引区分）
  const results = await Promise.allSettled(
    Array.from({ length: validatorCount }, (_, i) =>
      requestFn(txHash, eventIndex, i).catch(err => {
        console.warn(`Validator ${i} failed:`, err.message)
        throw err
      }),
    ),
  )

  const signatures: SignatureResponse[] = []
  let totalStake = 0

  // 收集成功的签名
  for (const result of results) {
    if (result.status === 'fulfilled') {
      signatures.push(result.value)
      if (stakePerValidator > 0) {
        totalStake += stakePerValidator
      } else {
        // Fallback: assume equal stake when API doesn't return it
        totalStake += 10000 / validatorCount
      }

      if (totalStake >= quorumStake) {
        break
      }
    }
  }

  if (totalStake < quorumStake) {
    throw new Error(`Failed to collect enough signatures. Got ${totalStake} stake, need ${quorumStake}`)
  }

  return signatures
}
