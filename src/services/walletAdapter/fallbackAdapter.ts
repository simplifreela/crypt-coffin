import { WalletAdapter } from "./index";

const FallbackAdapter: WalletAdapter = {
  id: "fallback",
  name: "Manual Address",
  supportedChains: ["evm", "solana", "near", "btc"],
  connect: async () => {
    // Fallback connect isn't interactive; it's a placeholder to allow manual add flows.
    throw new Error("Fallback adapter does not support interactive connect. Use addWatched instead.");
  },
  addWatched: async (address: string, name?: string) => {
    // This adapter just returns the provided address as-is; WalletContext will persist it.
    return { address, type: "evm", name } as any;
  },
};

export default FallbackAdapter;
