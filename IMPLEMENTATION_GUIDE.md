# Implementation Guide: Address Checksums, WalletAdapter, and PriceOracle

## Overview
This document details the changes made to address handling, wallet connection, token types, and price data loading in the Crypt Coffin app.

## Changes Made

### 1. Address Normalization (`src/lib/addressUtils.ts`)
- **Purpose**: Ensure consistent address storage across all networks
- **Strategy**: Lenient normalization — checksum when possible, preserve original if not
- **Supported Networks**:
  - **EVM**: Checksum addresses via `ethers.utils.getAddress()` (preserves case via EIP-55)
  - **Solana**: Validate & normalize via `@solana/web3.js` PublicKey
  - **Bitcoin**: Detect bech32 vs base58 and validate format
  - **Near**: Return as-is (no normalization available)

**Usage**:
```typescript
import { normalizeAddress } from '@/lib/addressUtils';

const result = await normalizeAddress('0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'evm');
// result = { address: '0xA0b86991c6218b36c1d19d4a2E9eb0ce3606eb48', normalized: true }
```

---

### 2. Token Model Update (`src/types/index.ts`)
- **Added field**: `tokenType: WalletType` ('evm' | 'solana' | 'near' | 'btc')
- **Purpose**: Record the network type for each token, enabling network-agnostic filtering and display

**Token interface**:
```typescript
interface Token {
  id: string;
  address: string;
  name: string;
  symbol: string;
  networkId: string;
  tokenType: WalletType; // NEW
  isCustom: boolean;
}
```

---

### 3. WalletAdapter Facade (`src/services/walletAdapter/`)
- **Purpose**: Abstract wallet connection logic into pluggable adapters (one per provider)
- **Registry** (`index.ts`): Auto-imports and registers built-in adapters on startup

**Interface**:
```typescript
interface WalletAdapter {
  id: string;
  name: string;
  supportedChains: WalletType[];
  connect: () => Promise<ConnectedWallet>;
  addWatched?: (address: string, name?: string) => Promise<ConnectedWallet>;
}
```

**Current Adapters**:
- `EvmAdapter` (`evmAdapter.ts`): Connect via window.ethereum (MetaMask, etc.)
- `FallbackAdapter` (`fallbackAdapter.ts`): Manual address entry (placeholder for future UI expansion)

**Usage in Components**:
```typescript
const { connectWallet } = useWallets();
await connectWallet('evm'); // Connect via EVM adapter
```

**Backwards compatibility**: `connectEvmWallet()` still exists in `WalletContext` as a wrapper around `connectWallet('evm')`.

---

### 4. PriceOracle Context (`src/contexts/PriceOracle.tsx`)
- **Purpose**: Load CMC price data once and share globally (non-blocking)
- **Loading**: Background fetch on app init (does not block initial render)
- **Refresh**: Auto-refreshes every 10 minutes
- **Error handling**: Silently fails if `/api/tokens` is unavailable

**Usage**:
```typescript
import { usePriceOracle } from '@/contexts/PriceOracle';

const { prices, getPriceBySymbol, loading } = usePriceOracle();
const usdcPrice = getPriceBySymbol('USDC'); // -> 1.0 (or undefined)
```

**Integration**: Wrapped in `src/app/layout.tsx` so all pages have access.

---

### 5. Storage Provider Updates

#### Supabase (`src/services/storage/supabase.ts`)
- `saveAllTokens()`: Normalizes addresses for all tokens before upsert
- `cacheBalances()`: Normalizes parsed balance addresses and uses consistent lookup keys
- `addCustomToken()`: Normalizes address for custom token storage
- Includes `tokenType` field in all token saves

#### IndexedDB (`src/services/storage/indexeddb.ts`)
- `addWallet()`: Normalizes wallet address when saving locally
- `saveAllTokens()`: Normalizes custom token addresses
- `addCustomToken()`: Normalizes custom token address before local storage
- Supports `tokenType` field for local tokens

**Key detail**: Address normalization is async/optional. If it fails, the original address is preserved and stored.

---

### 6. WalletContext Updates (`src/contexts/WalletContext.tsx`)

#### `addWatchedWallet()`
- Now calls `normalizeAddress()` before saving wallet
- Uses case-insensitive deduplication (`toLowerCase()` for comparison)
- Stores normalized address in DB

#### `connectWallet(providerId: string)` (NEW)
- Generic adapter-based connection
- Replaces direct MetaMask logic in `connectEvmWallet()`
- Normalizes connected address before saving
- Types: Supports any registered adapter ID (currently: 'evm', 'fallback')

#### Balance Fetching
- Orphaned-token validation preserved: skips stale cache if cached tokenIds don't exist in current token list
- Fresh on-chain fetches triggered when cache is invalid

---

## Architecture Flow

### When User Adds a Wallet (Watched or Connected)
1. User enters address or connects via injected provider
2. `connectWallet(providerId)` or `addWatchedWallet(address, type, name)` is called
3. Address is normalized via `normalizeAddress()` (checksum for EVM, etc.)
4. Normalized address is deduplicated (case-insensitive check)
5. Wallet is persisted via `dbService.addWallet()` (which delegates to Supabase or IndexedDB)
6. Storage provider normalizes address again (belt-and-suspenders approach)
7. Background balance fetch starts automatically

### When App Initializes
1. Layout wraps app with `PriceOracleProvider`
2. PriceOracle starts background fetch of CMC data (non-blocking)
3. `WalletContext.init()` runs:
   - Loads wallets, networks, and custom tokens from storage
   - Builds master token list from `contract-addresses.json` + custom tokens
   - Sets `tokenType` for each token
   - Saves all tokens to DB (cloud mode) via `saveAllTokens()`
   - Sets state with tokens (triggers balance fetches)
4. Each wallet triggers `fetchBalances(wallet)` in background:
   - Checks cache; if cache tokenIds are orphaned (don't exist in current token list), skip cache
   - Fetches fresh balances from balance providers
   - Uses PriceOracle prices to compute USD values
   - Caches results via `dbService.cacheBalances()`

### After Token Table Wipe (Cloud Sync)
1. Fresh login: `init()` runs and rebuilds token list from  `contract-addresses.json`
2. All tokens saved to DB with `saveAllTokens()` (awaited)
3. Cached balance lookups fail orphaned-token check (old tokenIds don't exist)
4. Fresh on-chain fetches are triggered automatically
5. New balances cached with correct DB token IDs

---

## Key Design Decisions

### Address Casing
- **Preserved as-is** when normalization is not available (e.g., Solana)
- **Never lowercased** anywhere in the codebase
- **Checksummed** for EVM using ethers.js (case-sensitive per EIP-55)
- **Stored consistently** across both Supabase and IndexedDB

### Token Types
- Stored in `Token.tokenType` to enable filtering without network lookups
- Matches `Wallet.type` enum for simplicity
- Set during `buildMasterTokenList()` and persisted in DB

### PriceOracle Non-Blocking Load
- Fetches asynchronously; app does not wait for prices
- Balance fetches may initial show USD = 0 until prices arrive
- Prices automatically updated every 10 minutes
- Fallback CMC price fetch in balance providers if initial price is 0

### WalletAdapter Generic Pattern
- Single point of extension for new wallet providers
- No special-casing per network type in `WalletContext`
- Can add SolanaAdapter, BitcoinAdapter, etc. in the future without modifying existing code
- Backwards compat maintained: `connectEvmWallet()` still works

---

## Testing Checklist

### Manual QA: Fresh Token Table Wipe Flow
1. Delete Token table in Supabase
2. Log in with connected EVM wallet
3. Verify:
   - ☐ Tokens rebuild from contract-addresses.json
   - ☐ All tokens saved to DB
   - ☐ Balance fetches complete without errors
   - ☐ Balances display correct USD values (via PriceOracle)
   - ☐ No stale cache is loaded

### Manual QA: Address Normalization
1. Add an EVM wallet with mixed-case address (e.g., `0xa0B869...`)
2. Verify: Stored address is checksummed (e.g., `0xA0b869...`)
3. Add a Solana address
4. Verify: Address is preserved as-entered
5. Try adding duplicate wallet: Should fail with case-insensitive check

### Manual QA: WalletAdapter
1. Open AddWalletDialog, click "Connect MetaMask"
2. Verify: MetaMask popup appears and connection works (EvmAdapter)
3. Verify: Returned address is normalized and saved

---

## Files Modified

Core Implementation:
- `src/lib/addressUtils.ts` — NEW
- `src/services/walletAdapter/index.ts` — NEW
- `src/services/walletAdapter/evmAdapter.ts` — NEW
- `src/services/walletAdapter/fallbackAdapter.ts` — NEW
- `src/contexts/PriceOracle.tsx` — NEW
- `src/types/index.ts` — Updated (Token.tokenType added)
- `src/services/tokenService.ts` — Updated (tokenType in buildMasterTokenList)
- `src/services/storage/supabase.ts` — Updated (normalize addresses, tokenType)
- `src/services/storage/indexeddb.ts` — Updated (normalize addresses)
- `src/contexts/WalletContext.tsx` — Updated (connectWallet, address normalization)
- `src/app/layout.tsx` — Updated (PriceOracleProvider wrapper)
- `src/components/dialogs/AddWalletDialog.tsx` — Updated (connectWallet usage)

Test Files:
- `tests/addressUtils.test.js` — NEW (plain JS test script)
- `tests/addressUtils.test.ts` — NEW (TypeScript test template)

---

## Future Enhancements

### Additional Wallet Adapters
- `SolanaAdapter` for Phantom/Solflare
- `BitcoinAdapter` for hardware wallets (once BTC support matures)
- `NearAdapter` for NEAR Protocol

### Enhanced Price Oracle
- Subscribe to WebSocket price updates (instead of 10-min polling)
- Store historical price snapshots for charting
- Support multiple price sources (Coingecko fallback, etc.)

### Address Normalization Improvements
- Persist `addressNormalized` flag to avoid re-normalizing on every load
- Add cached decompression for Solana PublicKeys

---

## Migration Notes

### For Existing Data
- Old lowercased addresses in DBs should be preserved as-is
- New addresses saved will follow the normalization rules
- Case-insensitive deduplication handles mixed casing gracefully
- Balance lookup will attempt normalization on both old and new addresses

### Breaking Changes
- `Token` interface now requires `tokenType` — custom token creation must supply this
- `connectEvmWallet()` still works but is deprecated (use `connectWallet('evm')`)
- No changes to Balance or Wallet interfaces

---

## Questions & Support
- For checksum validation issues: Check `addressUtils.ts` error logs
- For stale cache issues: Monitor orphaned-token validation warnings in console
- For PriceOracle: Check network tab for `/api/tokens` fetch success
- For adapter issues: Verify adapter is registered in `walletAdapter/index.ts`
