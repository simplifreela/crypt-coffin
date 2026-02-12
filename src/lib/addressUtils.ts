import type { WalletType } from "@/types";

export interface NormalizeResult {
  address: string;
  normalized: boolean;
  error?: string;
}

export async function normalizeAddress(
  address: string,
  chain: WalletType,
): Promise<NormalizeResult> {
  if (!address || typeof address !== "string") {
    return { address, normalized: false, error: "Invalid address" };
  }

  try {
    if (chain === "evm") {
      // Try to checksum using ethers
      try {
        // dynamic import so code doesn't crash if ethers isn't installed in some environments
        const ethers = await import("ethers");
        const checksummed = ethers.utils.getAddress(address);
        return { address: checksummed, normalized: true };
      } catch (e) {
        return { address, normalized: false, error: "EVM checksum failed" };
      }
    }

    if (chain === "solana") {
      try {
        const solana = await import("@solana/web3.js");
        const pub = new solana.PublicKey(address);
        return { address: pub.toString(), normalized: true };
      } catch (e) {
        return { address, normalized: false, error: "Invalid Solana address" };
      }
    }

    if (chain === "btc") {
      // Try bs58check or bech32 validation if available
      // If not available, perform lightweight pattern checks and return as-is
      try {
        const bs58check = await import("bs58check");
        try {
          // This will throw for invalid base58check addresses
          bs58check.decode(address);
          return { address, normalized: true };
        } catch (e) {
          // Not a base58check address, try bech32
        }
      } catch (e) {
        // bs58check not available; continue
      }

      try {
        const bech32 = await import("bech32");
        try {
          const decoded = bech32.bech32.decode(address);
          if (decoded && decoded.prefix) {
            return { address, normalized: true };
          }
        } catch (e) {
          // Not bech32
        }
      } catch (e) {
        // bech32 not available
      }

      // Fallback: basic regex for common BTC formats (very lenient)
      const bech32Regex = /^(bc1|tb1)[0-9a-zA-Z]{6,}$/;
      const base58Regex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,39}$/;

      if (bech32Regex.test(address) || base58Regex.test(address)) {
        return { address, normalized: true };
      }

      return { address, normalized: false, error: "Unrecognized BTC address format" };
    }

    // For other/unknown chains (near, etc.) return original address and not normalized
    return { address, normalized: false };
  } catch (error) {
    return { address, normalized: false, error: String(error) };
  }
}

export async function isValidAddress(address: string, chain: WalletType): Promise<boolean> {
  const res = await normalizeAddress(address, chain);
  return res.normalized === true;
}
