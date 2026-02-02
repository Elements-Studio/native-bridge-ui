# 设置 gas 参数（Starcoin / Starmask）

目的：说明 swap 交易如何把 `max_gas_amount` / `gas_unit_price` 传给 Starmask，以及钱包侧如何接收。

## 结论（简版）

- Dapp 侧需要把 **gas 相关字段**传给钱包：
  - `txParams.gas` -> 对应链上 `max_gas_amount`
  - `txParams.gasPrice` -> 对应链上 `gas_unit_price`
  - 字段值是 **hex string**（无 0x 也可，但钱包内部会按 hex 处理）
- 如果 Dapp 不传这两个字段，Starmask 会走 **simulate / estimate** 自动填充。

## Dapp 侧（interface）

- `/swap` 触发 `useSwapCallback`，最终调用 `useTokenSwapScript` 发送交易。
- 当前实现只传了 `data` 与 `expiredSecs`，**没有**传 `gas` / `gasPrice`：
  - `interface/src/hooks/useTokenSwapScript.ts` 中 `sendUncheckedTransaction({ data, expiredSecs })`
- 这意味着 gas 取值由钱包侧估算。

## 钱包侧（starmask-extension）如何接收 gas

### 1) 交易入口

- dapp 调用 `sendUncheckedTransaction` 后，进入 `newUnapprovedTransaction(txParams, req)`。

### 2) 签名时消费 gas

- `signTransaction` 中读取 `txMeta.txParams.gas` / `txMeta.txParams.gasPrice`，并作为 `max_gas_amount` / `gas_unit_price` 生成 raw txn。

### 3) dapp 不传 gas 时的默认估算

- `tx-gas-utils` 会 `simulateTransaction`，拿到 `gas_unit_price` / `max_gas_amount` 并回填。

### 4) 多签场景

- 多签交易从 raw txn 里取 `gas_unit_price` / `max_gas_amount`，再回填成 `txParams.gasPrice` / `txParams.gas`。

## 建议（如果需要自定义 gas）

- 在 dapp 侧调用 `sendUncheckedTransaction` 时补充参数：
  - `gas`: hex(max_gas_amount)
  - `gasPrice`: hex(gas_unit_price)
- 这样钱包就会使用 dapp 指定的 gas 区间，而不是自动估算。

## 参考位置

- interface:
  - `interface/src/pages/Swap/index.tsx`
  - `interface/src/hooks/useSwapCallback.ts`
  - `interface/src/hooks/useTokenSwapScript.ts`
- starmask-extension:
  - `app/scripts/controllers/transactions/index.js`（`signTransaction`）
  - `app/scripts/controllers/transactions/tx-gas-utils.js`（simulate/estimate）
  - `app/scripts/metamask-controller.js`（`newUnapprovedTransaction` 入口）
