import useEvmTools from '@/hooks/useEvmTools'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { getMetaMask } from '@/lib/evmProvider'
import { useEffect } from 'react'

export default function GlobalInitial() {
  const { tryReconnect: tryReconnectEvm } = useEvmTools()
  const { tryReconnect: tryReconnectStarcoin } = useStarcoinTools()
  useEffect(() => {
    getMetaMask() // 初始化并缓存 MetaMask 实例到 idmp，加快后续速度
    tryReconnectEvm()
    tryReconnectStarcoin()
  }, [])

  return null
}
