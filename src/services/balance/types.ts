import type { Wallet, Token, Balance, EVMNetwork } from "@/types";
import { TokenPriceInfo } from "../tokenService";

/**
 * BalanceProvider abstraction:
 * Each chain type (EVM, BTC, Solana, Near) implements this interface
 * allowing for easy addition of new chains without modifying WalletContext
 */
export interface BalanceProvider {
  /**
   * Fetch all balances for a wallet on this chain
   * @returns Array of balances or empty array if no tokens found
   */
  fetchWalletBalances(
    wallet: Wallet,
    tokens: Token[],
    networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance[]>;

  /**
   * Fetch a single token balance
   * @returns Balance object or null if balance is 0 or error
   */
  fetchTokenBalance(
    wallet: Wallet,
    token: Token,
    networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance | null>;

  /**
   * Check if this provider handles the given wallet type
   */
  supportsWalletType(type: string): boolean;
}
