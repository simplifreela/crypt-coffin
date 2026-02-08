
// This is a placeholder for a future Firebase implementation.
import type { Wallet, EVMNetwork, Token, Balance } from '@/types';
import type { StorageProvider } from './types';

const NOT_IMPLEMENTED_ERROR = "Firebase provider not implemented.";

export class FirebaseStorageProvider implements StorageProvider {
    
    constructor() {
        console.log("Initializing Firebase Storage Provider... (Placeholder)");
        // In the future, this would initialize Firestore, Auth, etc.
    }

    async getWallets(): Promise<Wallet[]> {
        console.warn(NOT_IMPLEMENTED_ERROR);
        return [];
    }
    
    async saveWallets(wallets: Wallet[]): Promise<void> {
        console.warn(NOT_IMPLEMENTED_ERROR);
    }
    
    async getCustomNetworks(): Promise<EVMNetwork[]> {
        console.warn(NOT_IMPLEMENTED_ERROR);
        return [];
    }
    
    async saveCustomNetworks(networks: EVMNetwork[]): Promise<void> {
        console.warn(NOT_IMPLEMENTED_ERROR);
    }
    
    async getCustomTokens(): Promise<Token[]> {
        console.warn(NOT_IMPLEMENTED_ERROR);
        return [];
    }
    
    async saveCustomTokens(tokens: Token[]): Promise<void> {
        console.warn(NOT_IMPLEMENTED_ERROR);
    }
    
    async getCachedBalances(walletId: string): Promise<{ balances: Balance[], timestamp: number } | undefined> {
        console.warn(NOT_IMPLEMENTED_ERROR);
        return undefined;
    }
    
    async cacheBalances(walletId: string, balances: Balance[]): Promise<void> {
        console.warn(NOT_IMPLEMENTED_ERROR);
    }
    
    async clearCachedBalances(walletId: string): Promise<void> {
        console.warn(NOT_IMPLEMENTED_ERROR);
    }
}
