import type { EIP1193Provider } from '@/types/domain'
import { getInjectedProvidersFromWindow } from './_tools'

export const getProvider = async (): Promise<EIP1193Provider | null> => {
  const providers = getInjectedProvidersFromWindow()
  if (providers.length === 0) return null
  return providers[0]
}
