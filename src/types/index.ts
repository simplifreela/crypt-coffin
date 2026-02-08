export type WalletType = 'evm' | 'solana' | 'near' | 'btc';

export interface User {
  id: string; // uuid from auth.uid()
  email?: string;
  isPremium: boolean;
  premiumExpiresAt?: string; // ISO 8601 string for DB compatibility
  createdAt: string;
  walletAddress: string;
  premiumPurchases: {
    amountUSD: number;
    /**
     * amount in the token currency.
     * This value MUST be string to comply
     * with BigNumber (1e18)
     */
    amountToken: string;
    date: string; // ISO 8601 string
    txHash: string;
    token: {
      address?: string; // to track the real token address
      native?: boolean // true if it's a native token like BTC or ETH
      symbol: string;
      network: string;
    };
  }[];
}

export interface Wallet {
  id: string; // uuid from DB
  address: string;
  type: WalletType;
  name: string; // e.g., "Metamask", "Watched Wallet 1"
  isWatched: boolean; // true if it's a watched wallet, false if connected
  userId?: string; // Foreign key to User
}
export type NewWallet = Omit<Wallet, 'id' | 'userId'>;


export interface EVMNetwork {
  id: string; // uuid from DB for custom networks, chainId for default
  chainId: number;
  name: string;
  rpcUrl: string;
  isCustom: boolean;
  symbol: string;
  userId?: string; // Foreign key to User for custom networks
}
export type NewEVMNetwork = Omit<EVMNetwork, 'id' | 'userId' | 'isCustom'>;

// Token is now a normalized entity representing a specific contract on a specific chain.
// It does not contain user-specific information.
export interface Token {
  id: string; // Globally unique ID, e.g., '1-0x....' for ETH-USDT
  address: string; // Contract address or 'native'
  name: string;
  symbol: string;
  networkId: string;
  isCustom: boolean;
}

// Balance represents the relationship between a User, a Wallet, and a Token.
// This is the structure we'll aim for in our Supabase 'balances' table.
export interface Balance {
  id: string; // A unique ID for the balance record
  walletId: string;
  tokenId: string;
  userId: string | null;
  
  // Current balance for quick display
  balance: string; 
  balanceUSD: string;
  
  createdAt: string;
  updatedAt: string;
  
  // Historical data for charts
  previousBalances: {
    time: string;
    balance: string;
    balanceUSD: string;
  }[];
}
