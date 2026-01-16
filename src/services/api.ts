import axios, { AxiosError, type AxiosInstance } from 'axios'
import type {
  HealthResponse,
  QuotaResponse,
  SignatureResponse,
  TransferDetailResponse,
  TransferListParams,
  TransferListResponse,
} from './types'

const BRIDGE_INDEXER_BASE_URL = 'http://143.198.220.234:9800'
const SIGNATURE_SERVICE_BASE_URL = 'http://143.198.220.234:60002'

const bridgeIndexerClient: AxiosInstance = axios.create({
  baseURL: BRIDGE_INDEXER_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const signatureServiceClient: AxiosInstance = axios.create({
  baseURL: SIGNATURE_SERVICE_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const handleError = (error: AxiosError) => {
  if (error.response) {
    console.error('API Error:', error.response.status, error.response.data)
    throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`)
  } else if (error.request) {
    console.error('Network Error:', error.message)
    throw new Error('Network Error: No response from server')
  } else {
    console.error('Error:', error.message)
    throw error
  }
}

export const bridgeIndexerApi = {
  /**
   * Check service health
   */
  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await bridgeIndexerClient.get<HealthResponse>('/health')
      return response.data
    } catch (error) {
      return handleError(error as AxiosError)
    }
  },

  /**
   * Get transfer detail by chain_id and nonce
   */
  async getTransferDetail(chainId: number, nonce: number): Promise<TransferDetailResponse> {
    try {
      const response = await bridgeIndexerClient.get<TransferDetailResponse>(`/transfers/${chainId}/${nonce}`)
      return response.data
    } catch (error) {
      return handleError(error as AxiosError)
    }
  },

  /**
   * Get transfer list by address with optional pagination
   */
  async getTransferList(params: TransferListParams): Promise<TransferListResponse> {
    try {
      const response = await bridgeIndexerClient.get<TransferListResponse>('/transfers', { params })
      return response.data
    } catch (error) {
      return handleError(error as AxiosError)
    }
  },

  /**
   * Get quota information
   */
  async getQuota(): Promise<QuotaResponse> {
    try {
      const response = await bridgeIndexerClient.get<QuotaResponse>('/quota')
      return response.data
    } catch (error) {
      return handleError(error as AxiosError)
    }
  },
}

export const signatureServiceApi = {
  /**
   * Get bridge transaction signature
   * @param fromChain - Source chain (e.g., 'starcoin')
   * @param toChain - Destination chain (e.g., 'eth')
   * @param txHash - Transaction hash
   * @param eventIndex - Event index
   */
  async getBridgeSignature(fromChain: string, toChain: string, txHash: string, eventIndex: number): Promise<SignatureResponse> {
    try {
      const response = await signatureServiceClient.get<SignatureResponse>(
        `/sign/bridge_tx/${fromChain}/${toChain}/${txHash}/${eventIndex}`,
      )
      return response.data
    } catch (error) {
      return handleError(error as AxiosError)
    }
  },
}

export { bridgeIndexerClient, signatureServiceClient }
