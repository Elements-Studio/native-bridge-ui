async function sha256Buffer(message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  return await crypto.subtle.digest('SHA-256', data)
}

export async function sha256(message: string): Promise<string> {
  const hashBuffer = await sha256Buffer(message)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}
