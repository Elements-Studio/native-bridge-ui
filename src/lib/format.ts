export function normalizeEip1193Error(err: any): Error {
  const code = err?.code
  const msg = err?.message || String(err)
  // 4001: user rejected
  // -32002: request already pending
  const suffix = code != null ? ` (code: ${code})` : ''
  return new Error(msg + suffix)
}
