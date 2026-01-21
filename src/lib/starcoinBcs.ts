function uleb128(value: number): Uint8Array {
  const bytes: number[] = []
  let v = value >>> 0
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  bytes.push(v)
  return Uint8Array.from(bytes)
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string: ${hex}`)
  }
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16)
  }
  return out
}

export function serializeU8(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff)
}

export function serializeU64(value: number | bigint): Uint8Array {
  const v = BigInt(value)
  const out = new Uint8Array(8)
  let tmp = v
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(tmp & 0xffn)
    tmp >>= 8n
  }
  return out
}

export function serializeString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value)
  return concatBytes([uleb128(bytes.length), bytes])
}

export function serializeBytes(value: Uint8Array): Uint8Array {
  return concatBytes([uleb128(value.length), value])
}

export function serializeAddress(address: string): Uint8Array {
  const clean = address.startsWith('0x') ? address.slice(2) : address
  const padded = clean.padStart(32, '0')
  return hexToBytes(padded)
}

export function serializeScriptFunctionPayload(options: {
  moduleAddress: string
  moduleName: string
  functionName: string
  typeArgs?: Uint8Array[]
  args?: Uint8Array[]
}): Uint8Array {
  const typeArgs = options.typeArgs ?? []
  const args = options.args ?? []

  const moduleId = concatBytes([serializeAddress(options.moduleAddress), serializeString(options.moduleName)])
  const functionName = serializeString(options.functionName)
  const typeArgsBytes = concatBytes([uleb128(typeArgs.length), ...typeArgs])
  const argsBytes = concatBytes([uleb128(args.length), ...args.map(arg => serializeBytes(arg))])

  const scriptFunction = concatBytes([moduleId, functionName, typeArgsBytes, argsBytes])
  const payloadType = serializeU8(2)
  return concatBytes([payloadType, scriptFunction])
}

export function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`
}
