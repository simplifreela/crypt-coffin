
import type { Wallet, EVMNetwork, Token, Balance, NewWallet, NewEVMNetwork } from '@/types';

export interface StorageProvider {
  getWallets(): Promise<Wallet[]>;
  addWallet(wallet: NewWallet): Promise<Wallet>;
  removeWallet(walletId: string): Promise<void>;

  getCustomNetworks(): Promise<EVMNetwork[]>;
  addCustomNetwork(network: NewEVMNetwork): Promise<EVMNetwork>;
  removeCustomNetwork(networkId: string): Promise<void>;

  getCustomTokens(): Promise<Token[]>;
  saveAllTokens(tokens: Token[]): Promise<void>;
  addCustomToken(token: Token): Promise<void>;
  removeCustomToken(tokenId: string): Promise<void>;

  getCachedBalances(walletId: string): Promise<{ balances: Balance[], timestamp: number } | undefined>;
  cacheBalances(walletId: string, balances: Balance[]): Promise<void>;
  clearCachedBalances(walletId: string): Promise<void>;
}
