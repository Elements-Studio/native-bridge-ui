import useEvmTools from '@/hooks/useEvmTools'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { getMetaMask } from '@/lib/evmProvider'
import { useEffect } from 'react'

export default function GlobalInitial() {
  const { initListener: initEvmListener, tryReconnect: tryReconnectEvm, disconnect: disconnectEvm } = useEvmTools()
  const { initListener: initStarcoinListener, tryReconnect: tryReconnectStarcoin, disconnect: disconnectStarcoin } = useStarcoinTools()

  useEffect(() => {
    getMetaMask() // 初始化并缓存 MetaMask 实例到 idmp，加快后续速度
    tryReconnectEvm()
    tryReconnectStarcoin()

    initEvmListener({ onUnauthenticated: disconnectEvm })
    initStarcoinListener({ onUnauthenticated: disconnectStarcoin })
  }, [tryReconnectEvm, tryReconnectStarcoin, disconnectEvm, disconnectStarcoin, initEvmListener, initStarcoinListener])

  return null
}
