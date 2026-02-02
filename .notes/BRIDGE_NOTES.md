# Bridge Integration Notes

## Goal

Implement **Bridge assets** flow for **Ethereum (Sepolia) -> Starcoin (Halley)**, using existing hooks and API helpers.

## Current code touchpoints

- EVM tools: `src/hooks/useEvmTools.tsx`
- Starcoin tools: `src/hooks/useStarcoinTools.tsx`
- API layer: `src/services/api.ts`
- UI trigger: `src/components/BridgeAssets/Panel.tsx`

## Required flow (from PRD)

1. User initiates ETH tx on source chain.
2. Poll Indexer until `is_finalized=true`.
3. Collect validator signatures (quorum stake >= 3334).
4. Submit target chain tx:
   - **ETH -> Starcoin**: `approve_bridge_token_transfer_*` then `claim_bridge_*`.
   - If status already `approved`: skip approve, only claim.

## Indexer/Validator API notes

- Chain ID mapping:
  - StarcoinMainnet: 0
  - StarcoinTestnet: 1
  - StarcoinCustom: 2
  - EthMainnet: 10
  - EthSepolia: 11
  - EthCustom: 12
- Token ID mapping:
  - USDT: 4
- Indexer endpoints:
  - `GET /transfers` (filter by address/status/finalized_only)
  - `GET /transfers/:chain_id/:nonce`
- Validator signatures:
  - `GET /sign/bridge_tx/eth/starcoin/:tx_hash/:event_index`
  - `GET /sign/bridge_tx/starcoin/eth/:tx_digest/:event_index`

## Missing info (must be provided later)

1. **Sepolia bridge contract address + ABI**
   - Exact function for ETH -> Starcoin deposit
   - Event name and field names for nonce/recipient/token_id/amount
2. **Starcoin bridge package address + module**
   - Full entry function signatures:
     - `approve_bridge_token_transfer_one/two/three` (arg order, typeArgs)
     - `claim_bridge_*` (arg order, typeArgs)
3. **EthToStarcoinBridgeAction -> Starcoin tx mapping**
   - Parameter mapping example, including signature vectors
4. **Starcoin tx submission API**
   - Whether to use `stc_sendTransaction` or a wrapper (example from repo)

## Notes

- ETH side likely uses `ethers.Contract` + `Signer` to submit.
- Starcoin side uses `window.starcoin` provider.
- Limiter scenario: if status `approved`, retry claim only (no new signatures).

## Example addresses (provided)

- Source (EVM) address: `0x59DD7EB576bEF653b91f55F595ef798Ae086B9a4`
- Destination (Starcoin) address: `0x48203f64254a45d942c21b1d2c4bc360`

## Known EVM-side facts (from Sepolia tx 0x38c0...9255)

- EVM bridge contract (Sepolia): `0x6fB6a37Fe87199c5B30271E9b9525C413b57Ce4D`
- Function called: `bridgeERC20(tokenID, amount, recipientAddress, destinationChainID)`
  - tokenID = 4 (USDT)
  - amount = 1_000_000
  - recipientAddress (bytes, 16 bytes) = `0x03ddb5b751b959e666995b56811cc10f`
  - destinationChainID = 1 (StarcoinTestnet)
- Event: `TokensDeposited(uint8 sourceChainID, uint64 nonce, uint8 destinationChainID, uint8 tokenID, uint64 starcoinAdjustedAmount, address senderAddress, bytes recipientAddress)`
  - sourceChainID = 11 (EthSepolia)
  - nonce = 0
  - destinationChainID = 1
  - tokenID = 4
  - starcoinAdjustedAmount = 1_000_000
  - senderAddress = `0x59DD7EB576bEF653b91f55F595ef798Ae086B9a4`
  - recipientAddress = `0x03ddb5b751b959e666995b56811cc10f`
- EVM logIndex for TokensDeposited = 0x63 (decimal 99)
- Validator API event_index appears to be 0 for bridge events (per docs/examples)

## Sample addresses (provided)

- Source (EVM) address: `0x59DD7EB576bEF653b91f55F595ef798Ae086B9a4`
- Destination (Starcoin) address: `0x48203f64254a45d942c21b1d2c4bc360`

## Starcoin Bridge module (from Bridge.move)

- Module: `Bridge::Bridge`
- Package address (provided): `0xf5ceaacf5d61ce430716e84ec65aa`

### ETH -> Starcoin approve

- `approve_bridge_token_transfer_single(sender, source_chain, seq_num, sender_address, target_chain, target_address, token_type, amount, signature)`
- `approve_bridge_token_transfer_two(sender, source_chain, seq_num, sender_address, target_chain, target_address, token_type, amount, sig1, sig2)`
- `approve_bridge_token_transfer_three(sender, source_chain, seq_num, sender_address, target_chain, target_address, token_type, amount, sig1, sig2, sig3)`

### ETH -> Starcoin claim (USDT)

- `claim_bridge_usdt(sender, clock_timestamp_ms, source_chain, bridge_seq_num)`

### Starcoin -> ETH send (USDT)

- `send_bridge_usdt(sender, target_chain, target_address, amount)`

## Implemented (frontend) — Starcoin -> Ethereum flow

### UI / Routing

- `Bridge assets` 按钮现在按方向分支：
  - `fromWalletType: EVM` + `toWalletType: STARCOIN` → 走原 ETH → Starcoin 逻辑（保持不变）。
  - `fromWalletType: STARCOIN` + `toWalletType: EVM` → 走新 Starcoin → Ethereum 逻辑。
- Starcoin→ETH 发起后跳转：`/transactions/:txHash?direction=starcoin_to_eth`

### Starcoin → Ethereum 逻辑（已实现）

1. 用户在 Starcoin 钱包签名并提交 `send_bridge_usdt`（Starcoin 侧发送）。
2. 轮询 Indexer，等待 `is_finalized=true`。
3. 并发请求 Validator 收集签名（quorum 规则见下）。
4. 在 Ethereum 侧构造并提交 `transferBridgedTokensWithSignatures`（包含 approve+claim 逻辑）。

### Starcoin 发送交易（Starcoin 侧）

- 构造 ScriptFunction Payload：
  - module: `Bridge::Bridge`
  - function: `send_bridge_usdt`
  - args: `[target_chain, target_address_bytes, amount_u64]`
    - target_chain = `BRIDGE_CONFIG.evm.chainId`
    - target_address_bytes = EVM 地址 20 bytes
    - amount_u64 = `parseUnits(inputBalance, decimals)`（目前 StarUSDT decimals 假设为 6）
- 使用 `stc_sendTransaction`（封装在 `useStarcoinTools.sendTransaction`）。

### Validator 签名收集

- API: `GET /sign/bridge_tx/starcoin/eth/:tx_digest/:event_index`
- 当前实现默认 `event_index = 0`。
- `collectSignatures` 增加可选 stake 校验：
  - 参数支持 `quorumStake` 与 `validatorStakes`
  - 仅当签名返回包含 stake 或显式 `validatorStakes` 时才会检查 quorum

### Ethereum 侧 Claim 交易（Starcoin → ETH）

- 合约 ABI 已加入：
  - `transferBridgedTokensWithSignatures(bytes[] signatures, tuple(uint8 messageType, uint8 version, uint64 nonce, uint8 chainID, bytes payload) message)`
- Message 构造：
  - `messageType = 0`
  - `version = 1`
  - `nonce = event.nonce`
  - `chainID = sourceChainId`（Starcoin chain id）
  - `payload` 按 Rust encoding.rs 的 abi.encodePacked 规则：
    - senderAddressLength(1) = 16
    - senderAddress(16) = Starcoin sender address
    - targetChain(1) = Eth chain id
    - recipientAddressLength(1) = 20
    - recipientAddress(20) = ETH recipient address
    - tokenID(1)
    - amount(8, big-endian u64)
- signatures: validator 返回的 base64 signature 转 bytes（65 bytes）后作为 `bytes[]`

### Indexer 轮询

- Starcoin → ETH 时：
  - 使用 `getTransferList({ address: starcoinWalletInfo.address, chain_id: BRIDGE_CONFIG.starcoin.chainId })`
  - `getTransferDetail(BRIDGE_CONFIG.starcoin.chainId, nonce)` 做兜底

## Config / 代码变更记录

- `src/lib/bridgeConfig.ts`
  - `starcoin.chainId` 新增（当前设为 `2`）
  - `tokens.StarUSDT` 新增（tokenId=4，claimFunction=claim_bridge_usdt，decimals=6，sendFunction=send_bridge_usdt）
  - `BRIDGE_ABI` 增加 `transferBridgedTokensWithSignatures` 声明
- `src/components/BridgeAssets/Panel.tsx`
  - 方向判断支持 `STARCOIN -> EVM`
  - 新增 Starcoin 发送交易逻辑与跳转参数
- `src/pages/Transactions/[:txnHash]/page.tsx`
  - 支持 `?direction=starcoin_to_eth`
  - 新增 Starcoin→ETH 的 indexer 轮询 / 签名收集 / ETH claim
- `src/services/api.ts`
  - `collectSignatures` 支持 `quorumStake` 与 `validatorStakes`（可选）
- `src/hooks/useStarcoinTools.tsx`
  - `getBalance` 对齐 StarMask / interface 实现：使用 `state.get_resource`（fallback `contract.get_resource`），解析 `resource.raw`（BCS u128 little-endian）和 `token.value` 结构
  - `typeTag` 地址补齐为 32 bytes（`0x1::` → `0x000...01::`）
- `src/components/BridgeAssets/CoinSelectorCard/index.tsx`
  - STARCOIN / EVM 分开调用 `getBalance`，避免 MetaMask 误切链导致 4902
- `src/components/BridgeAssets/CoinSelectorCard/CoinSelector.tsx`
  - 切币时按 `walletType` 调用对应 `getBalance`

## 待确认/待补充

1. `BRIDGE_CONFIG.starcoin.chainId` 当前默认 `2`（StarcoinCustom），请确认环境是否正确。
2. StarUSDT decimals 暂定为 `6`，请确认。
3. Validator 签名返回是否包含 stake 字段（或提供 URL → stake 的映射）。
4. Starcoin 事件 `event_index` 是否恒为 0（目前默认 0）。

## Starcoin 余额查询（Devnet/Halley）关键结论

- `StarUSDT` 必须使用完整 type tag：`0x9601de11320713ac003a6e41ab8b7dae::USDT::USDT`（不带 `::USDT` 会报错）
- Starcoin chainId：Halley = `0xfd`（注意不要误用 `0xfe` / `0x1`）
- `state.get_resource` 返回结构关键字段：
  - `resource.raw` 是 BCS 编码的 `u128`（little-endian）
  - 例：`raw = 0x00c2eb0b000000000000000000000000` → `200_000_000`（6 decimals 即 200 USDT）
- 解析优先级建议：
  1. `resource.raw` 解析为 u128（LE）
  2. 兼容解析 `resource.token.value` / `resource.json.token.value`
  3. 兼容解析 `resource.value[0][1].Struct.value[0][1].U128`（StarMask 旧格式）
- `state.get_resource` 失败可 fallback `contract.get_resource`
