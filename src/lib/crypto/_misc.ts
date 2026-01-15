const DEFAULT_STATIC_PASSWORD = 'STARCOIN_PASSWORD_V1'
const DEFAULT_STATIC_AAD = 'STARCOIN_AAD_V1'

// UTF-8 encoder/decoder
const te = new TextEncoder()
const td = new TextDecoder('utf-8')

const CryptoVersions = {
  v1: 'p',
} as const

// Alias for readability
type Bytes = Uint8Array

// —— Base64 helpers ——
// Uint8Array <-> Base64 (browser only: using btoa/atob)
function bytesToBase64(bytes: Bytes): string {
  let bin = ''
  const len = bytes.length
  for (let i = 0; i < len; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function base64ToBytes(b64: string): Bytes {
  const bin = atob(b64)
  const len = bin.length
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i)
  return out
}

// —— Derive AES key from password ——
// Explicitly type salt as Uint8Array, which is valid BufferSource
export async function deriveKey(password: string, salt: Bytes): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey'])

  const params: Pbkdf2Params = {
    name: 'PBKDF2',
    salt: salt as BufferSource,
    iterations: 200_000,
    hash: 'SHA-256',
  }

  return crypto.subtle.deriveKey(params, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/**
 * AES-GCM encryption
 * Output format: <v1>.<saltB64>.<ivB64>.<ctB64>
 */

export async function encrypt(text: string, password: string = DEFAULT_STATIC_PASSWORD, aad: string = DEFAULT_STATIC_AAD): Promise<string> {
  const salt: Bytes = crypto.getRandomValues(new Uint8Array(16)) // 16-byte random salt
  const iv: Bytes = crypto.getRandomValues(new Uint8Array(12)) // 12-byte random IV (nonce)

  const key = await deriveKey(password, salt)

  const gcmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as BufferSource,
    additionalData: te.encode(aad),
  }

  const ctBuf = await crypto.subtle.encrypt(
    gcmParams,
    key,
    te.encode(text), // supports Unicode / emoji
  )

  const ret = [CryptoVersions.v1, bytesToBase64(salt), bytesToBase64(iv), bytesToBase64(new Uint8Array(ctBuf))].join('.')

  return ret
}

/**
 * AES-GCM decryption
 */
export async function decrypt(
  encryptedData: string,
  password: string = DEFAULT_STATIC_PASSWORD,
  aad: string = DEFAULT_STATIC_AAD,
): Promise<string> {
  const parts = encryptedData.split('.')

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const salt = base64ToBytes(parts[1])
  const iv = base64ToBytes(parts[2])
  const ciphertext = base64ToBytes(parts[3])

  const key = await deriveKey(password, salt)

  const gcmParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as BufferSource,
    additionalData: te.encode(aad),
  }

  try {
    const decryptedBuf = await crypto.subtle.decrypt(gcmParams, key, ciphertext as BufferSource)

    return td.decode(new Uint8Array(decryptedBuf))
  } catch {
    throw new Error('Decryption failed - invalid password or AAD mismatch')
  }
}

export async function randomHex(length: number = 16): Promise<string> {
  const buffer = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomInRange(min: number, max: number): number {
  if (min >= max) {
    throw new Error('Invalid range: min should be less than max')
  }

  return min + (max - min) * Math.random() + Number.EPSILON
}
