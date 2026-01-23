import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import useStarcoinTools from '@/hooks/useStarcoinTools'
import { BRIDGE_ABI, BRIDGE_CONFIG, ERC20_ABI, normalizeHex } from '@/lib/bridgeConfig'
import { getMetaMask } from '@/lib/evmProvider'
import { bytesToHex, hexToBytes, serializeBytes, serializeScriptFunctionPayload, serializeU128, serializeU8 } from '@/lib/starcoinBcs'
import { getEstimateFees, type EstimateFeesResponse } from '@/services'
import { useGlobalStore } from '@/stores/globalStore'
import { BrowserProvider, Contract, getAddress, getBytes, parseUnits } from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CoinSelectorCard from './CoinSelectorCard'
import FromToCard from './FromToCard'
import './panel.styl'

export default function BridgeAssetPanel() {
  const { fromWalletType, toWalletType, currentCoin, evmWalletInfo, starcoinWalletInfo, inputBalance } = useGlobalStore()
  const { sendTransaction } = useStarcoinTools()
  const [fees, setFees] = useState<EstimateFeesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null)
  const [isBridging, setIsBridging] = useState(false)
  const navigate = useNavigate()

  const direction = useMemo(() => {
    if (fromWalletType === 'EVM' && toWalletType === 'STARCOIN') return 'eth_to_starcoin'
    if (fromWalletType === 'STARCOIN' && toWalletType === 'EVM') return 'starcoin_to_eth'
    return null
  }, [fromWalletType, toWalletType])

  useEffect(() => {
    let cancelled = false
    const fetchFees = async () => {
      setLoading(true)
      setError(null)
      setFees(null)
      try {
        if (!direction) {
          setError('Invalid bridge direction.')
          return
        }
        const res = await getEstimateFees(direction)
        if (!cancelled) setFees(res)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to estimate fees')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchFees()
    return () => {
      cancelled = true
    }
  }, [direction])

  const estimatedGas = useMemo(() => {
    if (loading) return <Spinner className="me-[0.2em]" />
    if (error) return <span className="text-red-300">--</span>
    if (!fees) return '-'
    return `≈ ${fees.combined_approve_and_claim_estimate}`
  }, [fees, loading, error])

  const handleBridge = useCallback(async () => {
    setBridgeError(null)
    setBridgeStatus(null)

    if (direction !== 'eth_to_starcoin' && direction !== 'starcoin_to_eth') {
      setBridgeError('Unsupported bridge direction.')
      return
    }

    setIsBridging(true)
    try {
      if (direction === 'eth_to_starcoin') {
        if (!evmWalletInfo?.address) {
          setBridgeError('Please connect your EVM wallet.')
          return
        }

        if (!starcoinWalletInfo?.address) {
          setBridgeError('Please connect your Starcoin wallet.')
          return
        }

        if (!inputBalance || Number(inputBalance) <= 0) {
          setBridgeError('Please enter a valid amount.')
          return
        }

        const tokenConfig = BRIDGE_CONFIG.tokens[currentCoin.name as keyof typeof BRIDGE_CONFIG.tokens]
        if (!tokenConfig || !currentCoin.ca) {
          setBridgeError('Selected token is not supported for ETH → Starcoin.')
          return
        }

        setBridgeStatus('Preparing EVM transaction...')
        const mm = await getMetaMask()
        if (!mm) throw new Error('MetaMask not detected')

        await mm.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BRIDGE_CONFIG.evm.chainIdHex }],
        })

        const provider = new BrowserProvider(mm)
        const signer = await provider.getSigner()
        const signerAddress = await signer.getAddress()

        const erc20 = new Contract(getAddress(currentCoin.ca), ERC20_ABI, signer)
        const decimals: number = await erc20.decimals()
        const amount = parseUnits(inputBalance, decimals)

        const bridgeAddress = getAddress(BRIDGE_CONFIG.evm.bridgeAddress)
        const allowance = (await erc20.allowance(signerAddress, bridgeAddress)) as bigint
        if (allowance < amount) {
          setBridgeStatus('Approving ERC20 spend...')
          const approveTx = await erc20.approve(bridgeAddress, amount)
          await approveTx.wait()
        }

        const recipientBytes = getBytes(normalizeHex(starcoinWalletInfo.address, 16))

        setBridgeStatus('Depositing on Ethereum...')
        const bridge = new Contract(bridgeAddress, BRIDGE_ABI, signer)
        const tx = await bridge.bridgeERC20(tokenConfig.tokenId, amount, recipientBytes, BRIDGE_CONFIG.evm.destinationChainId)
        const txHash = tx.hash as string
        setBridgeStatus('Transaction submitted. Redirecting...')
        navigate(`/transactions/${txHash}`)
        return
      }

      if (!starcoinWalletInfo?.address) {
        setBridgeError('Please connect your Starcoin wallet.')
        return
      }

      if (!evmWalletInfo?.address) {
        setBridgeError('Please connect your EVM wallet.')
        return
      }

      if (!inputBalance || Number(inputBalance) <= 0) {
        setBridgeError('Please enter a valid amount.')
        return
      }

      const tokenConfig = BRIDGE_CONFIG.tokens[currentCoin.name as keyof typeof BRIDGE_CONFIG.tokens]
      if (!tokenConfig || tokenConfig.sendFunction !== 'send_bridge_usdt') {
        setBridgeError('Selected token is not supported for Starcoin → Ethereum.')
        return
      }

      const decimals = 'decimals' in tokenConfig && typeof tokenConfig.decimals === 'number' ? tokenConfig.decimals : 6
      const amount = parseUnits(inputBalance, decimals)

      const recipientBytes = hexToBytes(normalizeHex(evmWalletInfo.address, 20))
      const sendArgs = [serializeU8(BRIDGE_CONFIG.evm.chainId), serializeBytes(recipientBytes), serializeU128(amount)]

      setBridgeStatus('Submitting on Starcoin...')
      const sendPayload = serializeScriptFunctionPayload({
        moduleAddress: BRIDGE_CONFIG.starcoin.packageAddress,
        moduleName: 'Bridge',
        functionName: tokenConfig.sendFunction,
        typeArgs: [],
        args: sendArgs,
      })

      const sendResult = await sendTransaction({ data: bytesToHex(sendPayload) })
      const txHash =
        typeof sendResult === 'string'
          ? sendResult
          : ((sendResult as { result?: string; hash?: string } | null)?.result ??
            (sendResult as { result?: string; hash?: string } | null)?.hash)
      if (!txHash) {
        throw new Error('Starcoin transaction hash not returned')
      }

      setBridgeStatus('Transaction submitted. Redirecting...')
      navigate(`/transactions/${txHash}?direction=starcoin_to_eth`)
      return
    } catch (err) {
      setBridgeError(err instanceof Error ? err.message : 'Bridge failed')
    } finally {
      setIsBridging(false)
    }
  }, [direction, evmWalletInfo, starcoinWalletInfo, inputBalance, currentCoin, navigate, sendTransaction])

  return (
    <div className="i-panel relative min-h-149 max-w-117.5 min-w-100 rounded-3xl bg-[rgba(44,41,88,0.8)]">
      {/* card1 */}
      <CoinSelectorCard />

      {/* Card2 */}
      <FromToCard />

      {/* Actions */}
      <div className="m-4 flex flex-col gap-6 rounded-b-4xl">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between px-2 text-[#abbdcc]">
            <div className="text-sm font-normal">Estimated Gas</div>
            <div className="flex items-center text-sm font-normal">{estimatedGas} ETH</div>
          </div>
          <div className="flex justify-between px-2 text-[#abbdcc]">
            <div className="text-sm font-normal">You receive</div>
            <div className="text-sm font-normal">{fees?.claim_estimate} USDT</div>
          </div>
        </div>

        <Button className="bg-[#346bba] text-gray-100" disabled={isBridging} onClick={handleBridge}>
          {isBridging ? <Spinner className="me-[0.2em]" /> : null}
          Bridge assets
        </Button>
        {bridgeStatus ? <div className="text-xs text-[#abbdcc]">{bridgeStatus}</div> : null}
        {bridgeError ? <div className="text-xs text-red-300">{bridgeError}</div> : null}
      </div>
    </div>
  )
}
