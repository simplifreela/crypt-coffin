"use client";

import { createClient } from "@/lib/supabase/client";
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
      .eq("userId", userId)
      .or("isCustom.eq.FALSE");

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
    const networks = await this.getCustomNetworks();

    const toSave = tokens.map((t) => ({
      id: t.id,
      address: `${t.networkId}-${t.address}`,
      name: t.name,
      symbol: t.symbol,
      networkId: networks.find((n) => n.id === t.networkId)?.id,
      isCustom: t.isCustom,
    }));

    const batchSize = 100;
    for (let i = 0; i < toSave.length; i += batchSize) {
      const batch = toSave.slice(i, i + batchSize);
      const { error } = await this.supabase
        .from("Token")
        .upsert(batch, { onConflict: "address" });
      if (error) {
        console.error("Error saving all tokens to Supabase:", error);
        throw new Error(error.message);
      }
    }
  }

  async addCustomToken(token: Token): Promise<void> {
    const { error } = await this.supabase
      .from("Token")
      .upsert(token, { onConflict: "id" });
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

    const balancesToSave = balances.map((b) => ({
      // The 'id' field is auto-generated by the DB, so we don't send it.
      walletId: b.walletId,
      tokenId: b.tokenId,
      userId: userId,
      balance: b.balance,
      balanceUSD: b.balanceUSD,
      createdAt: b.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      previousBalances: b.previousBalances || [],
    }));

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
}
