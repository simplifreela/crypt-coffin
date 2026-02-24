Plan: Address checksums, WalletAdapter, tokenType, and CMC oracle

Goals
- Make address handling deterministic and safe: checksum EVM addresses; validate/normalize other chains when possible but do not lowercase or force-case changes.
- Introduce a WalletAdapter facade to handle both connected providers and watched-address additions (one plug-in point per provider).
- Add `tokenType` to `Token` (values mirror `Wallet.type`: 'evm'|'solana'|'near'|'btc') and ensure tokens saved include this field.
- Load CMC oracle data in background at app startup and expose via a small `PriceOracle` context used by balance logic.
- Enforce using the `dbService` facade for all DB/indexedDB writes/reads.

Design decisions (agreed)
- Checksumming strategy: Lenient — attempt checksum/normalization when libraries support it; if not, save address as-provided (no lowercasing). Reject only obviously invalid formats.
- WalletAdapter: Full responsibility — connect/disconnect and also provide a standard method to add watched addresses through adapters when necessary.
- CMC Loading: Start in background on app init (non-blocking). Price map available via `PriceOracle` context.
- Implementation order: Checksumming utilities first (foundational), then types/token model, then WalletAdapter, then PriceOracle, then wiring into `WalletContext` and balance flow.

Implementation steps (what to change, files to edit)
1) Checksumming utilities (library & new module)
   - Create `src/lib/addressUtils.ts`:
     - Exports: `normalizeAddress(address: string, chain: WalletType): { address: string; normalized: boolean }`
     - EVM: use `ethers.utils.getAddress(address)` to compute checksum; catch and return error for invalid.
     - Solana: use `@solana/web3.js` `PublicKey` constructor to validate; call `toString()` to normalize.
     - Bitcoin: detect bech32 vs base58; use `bech32` and `bs58check`/`bitcoinjs-lib` address validation to normalize when possible; if unsure, return original.
   - Keep behavior: never lower-case input; save normalized checksum when available. Return flag `normalized`.

2) Token model
   - Update `src/types/index.ts` `Token` interface to include `tokenType: WalletType` (or separate union if desired).
   - Update any code that constructs `Token` (e.g., `buildMasterTokenList` in `src/services/tokenService.ts`) to set `tokenType` per network.

3) WalletAdapter facade
   - Add `src/services/walletAdapter/index.ts` exposing:
     - `registerAdapter(id: string, adapter: WalletAdapter)` (for app startup)
     - `getAdapter(id: string): WalletAdapter`
   - Define `WalletAdapter` interface:
     - `connect(): Promise<ConnectedWallet>` — prompts user, returns address + meta
     - `addWatched(address: string): Promise<Wallet>` — normalize via addressUtils and persist via `dbService`
     - `id`, `name`, `supportedChains: WalletType[]`
   - Implement adapters for existing providers:
     - `EvmAdapter` (wraps window.ethereum/ethers BrowserProvider)
     - `SolanaAdapter` (wraps Phantom if available) — minimal implementation placeholder
     - A `FallbackAdapter` for manual address entry that uses `addWatched`
   - Replace direct `connectEvmWallet` usage in `WalletContext` with `WalletAdapter.getAdapter('evm').connect()`.

4) PriceOracle context
   - Add `src/contexts/PriceOracle.tsx` (React context)
     - On mount, fetch `/api/tokens` in background, build Map<symbol, price> and expose via context.
     - Expose `getPriceBySymbol(symbol: string): number | undefined` and full prices map.
   - Use `PriceOracle` in `WalletContext` and `balanceService` to compute USD values.

5) Master token list & tokenType
   - Update `buildMasterTokenList` to determine `tokenType` for each token entry (based on `platform` in `contract-addresses.json` or network mapping).
   - Ensure `ZERO_ADDRESS` mapping for native tokens keeps `tokenType` correct (e.g., ETH -> 'evm', BTC native -> 'btc').
   - Ensure `saveAllTokens` call in `WalletContext.init()` persists `tokenType`.

6) WalletContext wiring
   - Replace `connectEvmWallet` with generic `connectWallet(providerId)` that uses `WalletAdapter`.
   - Ensure `addWatchedWallet` uses `addressUtils.normalizeAddress()` before saving and uses case-insensitive duplicate checks using normalized address where available.
   - Keep `fetchBalances` orphaned-token validation; rely on `tokenType` when filtering tokens for a wallet.

7) Storage provider updates
   - `src/services/storage/*.ts`: ensure when cache keys or token lookups are performed, normalized/checksummed addresses are used where available.
   - IndexedDB ids: keep existing behavior, but ensure adapter produces consistent address strings.

8) Tests & QA
   - Unit tests for `addressUtils` (EVM checksum, Solana validation, BTC formats).
   - Integration test: fresh Token table wipe → app start → PriceOracle loads → tokens saved → balances fetched (no stale cache). Manual QA steps provided.

Acceptance criteria
- Adding a wallet (connected or watched) stores a normalized/checksummed address when possible and does not lowercase un-checksummable addresses.
- `WalletContext` no longer contains `connectEvmWallet`; instead, it calls `WalletAdapter.getAdapter('evm').connect()`.
- `Token` objects in DB include `tokenType` and master list persistence includes this field.
- PriceOracle loads in background at app startup and is used to compute `balanceUSD` on balance fetches.
- Fresh Token-table wipe flows re-build tokens from `contract-addresses.json`, write tokens via `dbService`, then fetch balances; no stale cached balances are used.

Non-goals / Constraints
- Do not change UI components unless required for wiring new context APIs.
- Do not commit any changes to git (local edits only).
- Keep changes minimal and additive; existing components should keep behavior unless modified explicitly.

Estimated effort (rough)
- Checksumming utilities: 1–2 hours
- Types & token model changes: 30–60 minute                                                                                                                                                                                                                       s
- WalletAdapter scaffold + adapters (evm + fallback): 2–3 hours
- PriceOracle context: 1 hour
- Wire-up in WalletContext + storage updates: 2–3 hours
- Tests & QA: 2–3 hours

Next steps (immediate)
1. Implement `addressUtils` module and add unit tests. (I'll start here.)
2. Update `Token` type and patch `buildMasterTokenList` to include `tokenType`.
3. Create `WalletAdapter` scaffold and update `WalletContext` to use it.

-- End of plan
