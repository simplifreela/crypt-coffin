import type { BalanceProvider } from "./types";
import { EVMBalanceProvider } from "./EVMProvider";
import { BTCBalanceProvider } from "./BTCProvider";
import { SolanaBalanceProvider } from "./SolanaProvider";
import { NearBalanceProvider } from "./NearProvider";
import type { Wallet, Token, Balance, EVMNetwork } from "@/types";
import type { TokenPriceInfo } from "../tokenService";

class BalanceService {
  private providers: BalanceProvider[];

  constructor() {
    this.providers = [
      new EVMBalanceProvider(),
      new BTCBalanceProvider(),
      new SolanaBalanceProvider(),
      new NearBalanceProvider(),
    ];
  }

  private getProvider(walletType: string): BalanceProvider {
    const provider = this.providers.find((p) => p.supportsWalletType(walletType));
    if (!provider) {
      throw new Error(`No provider found for wallet type: ${walletType}`);
    }
    return provider;
  }

  async fetchWalletBalances(
    wallet: Wallet,
    tokens: Token[],
    networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance[]> {
    const provider = this.getProvider(wallet.type);
    return provider.fetchWalletBalances(wallet, tokens, networks, priceInfo);
  }

  async fetchTokenBalance(
    wallet: Wallet,
    token: Token,
    networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance | null> {
    const provider = this.getProvider(wallet.type);
    return provider.fetchTokenBalance(wallet, token, networks, priceInfo);
  }

  /**
   * Fetch balances for multiple wallets in parallel
   * This replaces the old blocking behavior where all wallets had to load together
   */
  async fetchBalancesForMultipleWallets(
    wallets: Wallet[],
    tokens: Token[],
    networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Map<string, Balance[]>> {
    const balancesMap = new Map<string, Balance[]>();

    const promises = wallets.map(async (wallet) => {
      try {
        const balances = await this.fetchWalletBalances(
          wallet,
          tokens,
          networks,
          priceInfo,
        );
        balancesMap.set(wallet.id, balances);
      } catch (error) {
        console.error(`Failed to fetch balances for wallet ${wallet.id}`, error);
        balancesMap.set(wallet.id, []);
      }
    });

    await Promise.all(promises);
    return balancesMap;
  }
}

export const balanceService = new BalanceService();
