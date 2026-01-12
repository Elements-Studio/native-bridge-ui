import type { EIP1193Provider } from '@/types/domain'
import { getProvider as getDefault } from './default'
import { getProvider as getMetaMask } from './metaMask'

export const getAllProviders = async (): Promise<{
  hasMetaMask: boolean
  providers: EIP1193Provider[]
}> => {
  const [mm, def] = await Promise.all([getMetaMask(), getDefault()])
  return {
    hasMetaMask: !!mm,
    providers: [mm, def].filter(Boolean) as EIP1193Provider[],
  }
}
export { getMetaMask }
