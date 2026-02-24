"use client";

import { createClient } from "@/lib/supabase/client";
import { BigNumber } from "bignumber.js";
import type {
  Wallet,
  EVMNetwork,
  Token,
  Balance,
  NewWallet,
  NewEVMNetwork,
} from "@/types";
import type { StorageProvider } from "./types";
import { SupabaseClient } from "@supabase/supabase-js";
import { ZERO_ADDRESS } from "@/lib/constants";
import { normalizeAddress } from "@/lib/addressUtils";

export class SupabaseStorageProvider implements StorageProvider {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient();
  }

  private async getUserId(): Promise<string> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");
    return user.id;
  }

  /**
   * Serialize BigNumber instances to strings for DB storage
   */
  private serializeBalance(balance: BigNumber | string): string {
    return typeof balance === 'string' ? balance : balance.toString();
  }

  /**
   * Deserialize balance strings from DB back to BigNumber instances
   */
  private deserializeBalance(balance: Balance): Balance {
    return {
      ...balance,
      balance: new BigNumber(balance.balance),
    };
  }

  // Wallets
  async getWallets(): Promise<Wallet[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from("Wallet")
      .select("*")
      .eq("userId", userId);

    if (error) {
      console.error("Error fetching wallets from Supabase:", error);
      throw new Error(error.message);
    }
    return data as Wallet[];
  }

  async addWallet(walletData: NewWallet): Promise<Wallet> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from("Wallet")
      .insert({ ...walletData, userId })
      .select()
      .single();

    if (error) {
      console.error("Error adding wallet to Supabase:", error);
      throw new Error(error.message);
    }
    return data as Wallet;
  }

  async removeWallet(walletId: string): Promise<void> {
    const { error } = await this.supabase
      .from("Wallet")
      .delete()
      .eq("id", walletId);

    if (error) {
      console.error("Error removing wallet from Supabase:", error);
      throw new Error(error.message);
    }
  }

  // Custom Networks
  async getCustomNetworks(): Promise<EVMNetwork[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from("EVMNetwork")
      .select("*")
      .eq("userId", userId);

    if (error) throw error;

    return data as EVMNetwork[];
  }

  async addCustomNetwork(networkData: NewEVMNetwork): Promise<EVMNetwork> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from("EVMNetwork")
      .insert({
        ...networkData,
        userId: userId,
        isCustom: true,
        // The 'id' for custom networks is its chainId to maintain uniqueness per user
        chainId: networkData.chainId,
      })
      .select()
      .single();

    if (error) throw error;
    return data as EVMNetwork;
  }

  async removeCustomNetwork(networkId: string): Promise<void> {
    const userId = await this.getUserId();
    const { error } = await this.supabase
      .from("EVMNetwork")
      .delete()
      .match({ id: networkId, userId: userId });

    if (error) throw error;
  }

  // Custom Tokens (Global Table)
  async getCustomTokens(): Promise<Token[]> {
    // In cloud mode, all tokens (custom or not) are in the global Token table.
    // The context will filter them, but we fetch all to build the master list.
    const { data, error } = await this.supabase.from("Token").select("*");
    if (error) {
      console.error("Error fetching tokens from Supabase:", error);
      throw new Error(error.message);
    }
    return data as Token[];
  }

  async saveAllTokens(tokens: Token[]): Promise<void> {
    if (!tokens || tokens.length === 0) return;
    // When saving tokens to Supabase, DO NOT provide the client-side `id`.
    // The DB will generate a UUID for the token `id`. Uniqueness is enforced
    // by the (`address`, `networkId`) constraint in the DB.

    // Fetch networks from DB to map numeric/default network identifiers
    // (like "1" for Ethereum) to the actual DB network UUIDs.
    const { data: dbNetworks, error: netError } = await this.supabase
      .from("EVMNetwork")
      .select("id, chainId, isCustom");
    if (netError) {
      console.error("Error fetching networks for token mapping:", netError);
      throw netError;
    }

    const chainIdToDbId = new Map<string, string>();
    (dbNetworks || []).forEach((n: any) => {
      if (n.chainId !== null && n.chainId !== undefined) {
        chainIdToDbId.set(String(n.chainId), n.id);
      }
      // Also map DB id to itself for cases where token.networkId already is a UUID
      if (n.id) {
        chainIdToDbId.set(n.id, n.id);
      }
    });

    const toSave = tokens.map((t) => {
      // Determine DB networkId: map numeric/default ids to DB UUIDs.
      let mappedNetworkId: string | null = null;
      if (!t.networkId) mappedNetworkId = null;
      else if (["solana", "near", "btc"].includes(t.networkId))
        mappedNetworkId = null;
      else if (chainIdToDbId.has(t.networkId))
        mappedNetworkId = chainIdToDbId.get(t.networkId)!;
      else mappedNetworkId = t.networkId; // fallback: pass through (could be UUID already)

      return {
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        networkId: mappedNetworkId,
        isCustom: t.isCustom,
        tokenType: (t as any).tokenType || (mappedNetworkId ? "evm" : "evm"),
      };
    });

    const batchSize = 100;
    for (let i = 0; i < toSave.length; i += batchSize) {
      const batch = toSave.slice(i, i + batchSize);
      // Upsert using the uniqueness constraint on (address, networkId)
      // Normalize addresses before upsert to ensure consistent casing (checksummed for EVM)
      const normalizedBatchPromises = batch.map(async (b: any) => {
        const chain: any = b.tokenType === "solana" || b.networkId === null ? b.tokenType || null : "evm";
        if (b.address && b.address !== ZERO_ADDRESS) {
          try {
            const normalized = await normalizeAddress(b.address, chain || "evm");
            b.address = normalized.address;
          } catch (e) {
            // ignore normalization failures and keep original address
          }
        }
        return b;
      });
      const normalizedBatch = await Promise.all(normalizedBatchPromises);

      const { error } = await this.supabase
        .from("Token")
        .upsert(normalizedBatch, { onConflict: 'id' });
      if (error) {
        console.error("Error saving all tokens to Supabase:", error);
        throw new Error(error.message);
      }
    }
  }

  async addCustomToken(token: Token): Promise<void> {
    // Do not provide client-side id when inserting - let DB generate UUID.
    const payload: any = {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      // For non-EVM networks, set networkId to null
      networkId:
        token.networkId === "solana" ||
        token.networkId === "near" ||
        token.networkId === "btc"
          ? null
          : token.networkId,
      isCustom: token.isCustom,
        tokenType: (token as any).tokenType || (token.networkId === "solana" ? "solana" : "evm"),
      };

    const { error } = await this.supabase.from("Token").upsert(payload, {
      onConflict: 'id',
    });
    if (error) throw error;
  }

  async removeCustomToken(tokenId: string): Promise<void> {
    const userId = await this.getUserId();
    const { error } = await this.supabase
      .from("Balance")
      .delete()
      .match({ tokenId: tokenId, userId: userId });

    if (error) {
      console.error(`Error removing balances for token ${tokenId}:`, error);
      throw error;
    }
  }

  // Balance Caching (using the Balance table)
  async getCachedBalances(
    walletId: string,
  ): Promise<{ balances: Balance[]; timestamp: number } | undefined> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from("Balance")
      .select("*")
      .eq("walletId", walletId)
      .eq("userId", userId);

    if (error) {
      console.error(`Error getting balances for wallet ${walletId}:`, error);
      return undefined;
    }

    if (data && data.length > 0) {
      const transformedBalances = data.map((b) => ({
        ...b,
        id: `${b.walletId}-${b.tokenId}`,
        balance: new BigNumber(b.balance),
      })) as Balance[];

      const latestTimestamp = Math.max(
        ...data.map((b) => new Date(b.updatedAt).getTime()),
      );
      return { balances: transformedBalances, timestamp: latestTimestamp };
    }
    return { balances: [], timestamp: 0 };
  }

  async cacheBalances(walletId: string, balances: Balance[]): Promise<void> {
    const userId = await this.getUserId();

    // First, clear out old balances for this wallet to handle tokens that are now 0
    await this.clearCachedBalances(walletId);

    if (balances.length === 0) return;

    // Map frontend token identifiers to DB token UUIDs before inserting balances.
    // Frontend token.id is shaped like `${networkKey}-${address}` where networkKey
    // may be a chainId (e.g. "1"), a DB uuid, or a non-EVM tag like "solana".
    // We must resolve the DB Token.id using (address, networkId) pairs.

    // Fetch networks to resolve numeric chainIds to DB UUIDs
    const { data: dbNetworks, error: netError } = await this.supabase
      .from("EVMNetwork")
      .select("id, chainId");
    if (netError) {
      console.error(
        "Error fetching networks for balance token mapping:",
        netError,
      );
      throw netError;
    }
    const chainIdToDbId = new Map<string, string>();
    (dbNetworks || []).forEach((n: any) => {
      if (n.chainId !== null && n.chainId !== undefined)
        chainIdToDbId.set(String(n.chainId), n.id);
      if (n.id) chainIdToDbId.set(n.id, n.id);
    });

    type LookupKey = string; // `${address}|${networkDbIdOrNull}`
    const lookupKeys = new Set<LookupKey>();
    const parsedBalances: Array<{
      original: Balance;
      address: string;
      mappedNetworkId: string | null;
    }> = [];

    for (const b of balances) {
      // parse tokenId like "<networkKey>-<addr>"
      const parts = b.tokenId.split("-");
      const networkKey = parts[0];
      const addrPart = parts.slice(1).join("-");

      let mappedNetworkId: string | null = null;
      if (!networkKey || ["solana", "near", "btc"].includes(networkKey)) {
        mappedNetworkId = null;
      } else if (chainIdToDbId.has(networkKey)) {
        mappedNetworkId = chainIdToDbId.get(networkKey)!;
      } else if (/^[0-9a-fA-F-]{36}$/.test(networkKey)) {
        // Looks like a UUID
        mappedNetworkId = networkKey;
      } else {
        // Fallback: treat as null
        mappedNetworkId = null;
      }

      let address = addrPart;
      // Normalize native marker or empty into the ZERO_ADDRESS placeholder
      if (!address || address === "native" || address === ZERO_ADDRESS) {
        address = ZERO_ADDRESS;
      } else {
        // Attempt to normalize based on inferred chain
        try {
          const inferredChain: any = mappedNetworkId === null
            ? (networkKey as any)
            : "evm";
          const normalized = await normalizeAddress(address, inferredChain as any);
          address = normalized.address;
        } catch (e) {
          // ignore normalization failure
        }
      }

      parsedBalances.push({ original: b, address, mappedNetworkId });
      lookupKeys.add(`${address}|${mappedNetworkId ?? "null"}`);
    }

    // Group lookups by mappedNetworkId to query tokens efficiently
    const lookupsByNetwork = new Map<string | null, Set<string>>();
    for (const pb of parsedBalances) {
      const set = lookupsByNetwork.get(pb.mappedNetworkId) || new Set<string>();
      set.add(pb.address);
      lookupsByNetwork.set(pb.mappedNetworkId, set);
    }

    const tokenMap = new Map<LookupKey, string>(); // maps lookupKey -> dbTokenId

    for (const [mappedNetworkId, addrSet] of lookupsByNetwork.entries()) {
      const addresses = Array.from(addrSet);
      let query;
      if (mappedNetworkId === null) {
        query = this.supabase
          .from("Token")
          .select("id,address,networkId")
          .in("address", addresses)
          .is("networkId", null);
      } else {
        query = this.supabase
          .from("Token")
          .select("id,address,networkId")
          .in("address", addresses)
          .eq("networkId", mappedNetworkId);
      }
      const { data: foundTokens, error: tokenError } = await query;
      if (tokenError) {
        console.error("Error querying tokens for balance mapping:", tokenError);
        throw tokenError;
      }
      (foundTokens || []).forEach((t: any) => {
        const key = `${String(t.address)}|${t.networkId ?? "null"}`;
        tokenMap.set(key, t.id);
      });
    }

    const missing: string[] = [];
    const balancesToSave = parsedBalances.map(
      ({ original, address, mappedNetworkId }) => {
        const key = `${address}|${mappedNetworkId ?? "null"}`;
        const dbTokenId = tokenMap.get(key);
        if (!dbTokenId) {
          missing.push(key);
        }
        return {
          walletId: original.walletId,
          tokenId: dbTokenId || original.tokenId,
          userId,
          balance: this.serializeBalance(original.balance),
          balanceUSD: original.balanceUSD,
          createdAt: original.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          previousBalances: original.previousBalances || [],
        };
      },
    );

    if (missing.length > 0) {
      console.error("Missing token entries in DB for balances:", missing);
      throw new Error(
        `Missing token definitions in DB for some balances. Ensure tokens exist (address+network) before caching balances. Missing keys: ${missing.join(", ")}`,
      );
    }

    const { error } = await this.supabase
      .from("Balance")
      .upsert(balancesToSave, { onConflict: "walletId,tokenId,userId" });

    if (error) {
      console.error(`Error caching balances for wallet ${walletId}:`, error);
      if (error.code === "23503") {
        // Foreign key violation
        throw new Error(
          `Database schema mismatch. A token ID in your balances does not exist in the 'Token' table. Please ensure all tokens are saved before caching balances. Original error: ${error.message}`,
        );
      }
      if (error.code === "22P02") {
        // Invalid text representation (e.g. trying to save text to a uuid column)
        throw new Error(
          `Database schema mismatch. A value being saved doesn't match the expected data type in the 'Balance' table (e.g., text vs. uuid for tokenId). Please check your table schema. Original error: ${error.message}`,
        );
      }
      throw error;
    }
  }

  async clearCachedBalances(walletId: string): Promise<void> {
    const userId = await this.getUserId();
    const { error } = await this.supabase
      .from("Balance")
      .delete()
      .match({ walletId: walletId, userId: userId });

    if (error) {
      console.error(`Error clearing balances for wallet ${walletId}:`, error);
      throw error;
    }
  }

  // Wallet Updates
  async updateWallet(walletId: string, updates: Partial<any>): Promise<any> {
    const { data, error } = await this.supabase
      .from("Wallet")
      .update(updates)
      .eq("id", walletId)
      .select()
      .single();

    if (error) {
      console.error("Error updating wallet:", error);
      throw new Error(error.message);
    }
    return data;
  }

  // Network Updates
  async updateCustomNetwork(
    networkId: string,
    updates: Partial<any>,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from("EVMNetwork")
      .update(updates)
      .eq("id", networkId)
      .select()
      .single();

    if (error) {
      console.error("Error updating network:", error);
      throw new Error(error.message);
    }
    return data;
  }

  // Portfolio Overviews
  async getPortfolioOverviews(): Promise<any[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from("Overview")
      .select("*")
      .eq("userId", userId)
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Error fetching portfolio overviews:", error);
      throw new Error(error.message);
    }
    return data || [];
  }

  async addPortfolioOverview(overview: any): Promise<any> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from("Overview")
      .insert({ ...overview, userId })
      .select()
      .single();

    if (error) {
      console.error("Error adding portfolio overview:", error);
      throw new Error(error.message);
    }
    return data;
  }

  async updatePortfolioOverview(
    overviewId: string,
    updates: Partial<any>,
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from("Overview")
      .update(updates)
      .eq("id", overviewId)
      .select()
      .single();

    if (error) {
      console.error("Error updating portfolio overview:", error);
      throw new Error(error.message);
    }
    return data;
  }

  async removePortfolioOverview(overviewId: string): Promise<void> {
    const { error } = await this.supabase
      .from("Overview")
      .delete()
      .eq("id", overviewId);

    if (error) {
      console.error("Error removing portfolio overview:", error);
      throw new Error(error.message);
    }
  }
}
