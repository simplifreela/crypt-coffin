import type { WalletType } from "@/types";

export interface ConnectedWallet {
  address: string;
  type: WalletType;
  name?: string;
}

export interface WalletAdapter {
  id: string;
  name: string;
  supportedChains: WalletType[];
  connect: () => Promise<ConnectedWallet>;
  // optional: add a watched address via adapter-specific normalization/persistence
  addWatched?: (address: string, name?: string) => Promise<ConnectedWallet>;
}

const registry = new Map<string, WalletAdapter>();

export function registerAdapter(id: string, adapter: WalletAdapter) {
  registry.set(id, adapter);
}

export function getAdapter(id: string): WalletAdapter {
  const adapter = registry.get(id);
  if (!adapter) throw new Error(`Wallet adapter not registered: ${id}`);
  return adapter;
}

export function listAdapters(): string[] {
  return Array.from(registry.keys());
}

// Auto-register built-in adapters if present
// Lazy import so missing optional deps don't crash module import
async function tryAutoRegister() {
  try {
    const evm = await import("./evmAdapter");
    if (evm && evm.default) {
      registry.set(evm.default.id, evm.default);
    }
  } catch (e) {
    // ignore
  }
  try {
    const fb = await import("./fallbackAdapter");
    if (fb && fb.default) registry.set(fb.default.id, fb.default);
  } catch (e) {
    // ignore
  }
}

// kick off auto registration without awaiting
tryAutoRegister();
