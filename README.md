# Starcoin Bridge

A cross-chain bridge application for transferring assets between Starcoin and Ethereum networks.

Official website: https://bridge.starswap.xyz

## Requirements

- Node.js 25+ (<https://nodejs.org>)
- pnpm (<https://pnpm.io>)

## mkcert

Install mkcert (local HTTPS certificates):

```bash
brew install mkcert
brew install nss # for Firefox (optional)
mkcert -install
```

Official docs: <https://github.com/FiloSottile/mkcert>

## Installation

```bash
pnpm install
```

## Development

Run the development server:

```bash
pnpm dev
```

## Build

Build the application for production:

```bash
pnpm build
```

## Deployment

Deploy the application:

```bash
pnpm run deploy
```

## Architecture

Frontend stack

- Vite + React + TypeScript
- React Router for routing (`src/routes.tsx`)
- Zustand for shared state (`src/stores/globalStore.ts`)
- SWR for data fetching and polling (`src/pages/Transactions/page.tsx`, `src/components/TransactionsDetail/index.tsx`)
- Ethers for EVM interactions and StarMask for Starcoin interactions (`src/hooks/useEvmTools.tsx`, `src/hooks/useStarcoinTools.tsx`)

Environment configuration

- `src/env.development.ts` and `src/env.production.ts` define API endpoints, supported coins, bridge addresses, chain IDs, and icons.
- `src/lib/bridgeConfig.ts` exposes `BRIDGE_CONFIG` and ABIs used by bridge flows.

Routes and pages

- `/` Bridge UI (`src/pages/BridgeAssets.tsx` → `src/components/BridgeAssets/*`)
- `/transactions` Transfer list with direction tabs (`src/pages/Transactions/page.tsx`)
- `/transactions/:txnHash` Transfer detail with status progression (`src/pages/Transactions/[:txnHash]/page.tsx`)

Core business flows

- Bridge entry (`src/components/BridgeAssets/Panel.tsx`):
  - Estimates fees via `getEstimateFees(direction)`.
  - Validates wallet connections, amount, and token config.
  - EVM → Starcoin:
    - Switch EVM chain, check ERC20 allowance, approve if needed.
    - Call `bridgeERC20` on the EVM bridge contract.
    - Redirect to transaction detail with `direction=eth_to_starcoin`.
  - Starcoin → EVM:
    - Build Starcoin script payload (`send_bridge_usdt`) and submit via StarMask.
    - Navigate to transaction detail with `direction=starcoin_to_eth`.
- Wallet connect + balances (`src/components/BridgeAssets/CoinSelectorCard/*`, `src/components/BridgeAssets/FromToCard/*`):
  - EVM uses MetaMask; Starcoin uses StarMask.
  - Balances are fetched from the active chain and cached via `idmp`.
  - Switching “From/To” flips direction and resets amount + coin.
- Transfer list (`src/pages/Transactions/page.tsx`, `src/components/Transactions/TransfersTable.tsx`):
  - Lists transfers for the connected wallet using `getTransferList`.
  - Direction tabs map to `eth_to_starcoin` and `starcoin_to_eth`.
- Transfer detail workflow (`src/components/TransactionsDetail/*`):
  - Polls `getTransferByDepositTxn` until `is_complete`.
  - Derives status based on backend procedure:
    - Waiting for indexer → Collect signatures → Approve → Claim → Completed
  - Collects validator signatures from committee endpoints (`collectSignatures`), requires 3 distinct signatures.
  - Approve step:
    - EVM → Starcoin: submit Starcoin `approve_bridge_token_transfer_three`.
    - Starcoin → EVM: call EVM `approveTransferWithSignatures`.
  - Claim step:
    - EVM → Starcoin: Starcoin `claim_bridge_usdt`.
    - Starcoin → EVM: EVM `claimApprovedTransfer`.
  - Supports claim delay countdown if required by backend.

APIs and services

- `src/services/api.ts`:
  - `/transfers` for list and detail.
  - `/estimate_fees` for gas/fee estimates.
  - Committee signature endpoints for validator signatures.
  - `idmp` is used to de-duplicate and retry network requests.
