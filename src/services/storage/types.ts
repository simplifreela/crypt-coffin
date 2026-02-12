
import type { Wallet, EVMNetwork, Token, Balance, NewWallet, NewEVMNetwork, PortfolioOverview, NewPortfolioOverview } from '@/types';

export interface StorageProvider {
  getWallets(): Promise<Wallet[]>;
  addWallet(wallet: NewWallet): Promise<Wallet>;
  removeWallet(walletId: string): Promise<void>;
  updateWallet(walletId: string, updates: Partial<Wallet>): Promise<Wallet>;

  getCustomNetworks(): Promise<EVMNetwork[]>;
  addCustomNetwork(network: NewEVMNetwork): Promise<EVMNetwork>;
  removeCustomNetwork(networkId: string): Promise<void>;
  updateCustomNetwork(networkId: string, updates: Partial<EVMNetwork>): Promise<EVMNetwork>;

  getCustomTokens(): Promise<Token[]>;
  saveAllTokens(tokens: Token[]): Promise<void>;
  addCustomToken(token: Token): Promise<void>;
  removeCustomToken(tokenId: string): Promise<void>;

  getCachedBalances(walletId: string): Promise<{ balances: Balance[], timestamp: number } | undefined>;
  cacheBalances(walletId: string, balances: Balance[]): Promise<void>;
  clearCachedBalances(walletId: string): Promise<void>;

  getPortfolioOverviews(): Promise<PortfolioOverview[]>;
  addPortfolioOverview(overview: NewPortfolioOverview): Promise<PortfolioOverview>;
  updatePortfolioOverview(overviewId: string, updates: Partial<PortfolioOverview>): Promise<PortfolioOverview>;
  removePortfolioOverview(overviewId: string): Promise<void>;
}
