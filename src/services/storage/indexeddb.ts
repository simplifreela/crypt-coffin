"use client";

import * as db from '@/lib/db';
import type { Wallet, EVMNetwork, Token, Balance, NewWallet, NewEVMNetwork } from '@/types';
import type { StorageProvider } from './types';

const DB_KEYS = {
    WALLETS: 'wallets',
    CUSTOM_NETWORKS: 'custom_networks',
    CUSTOM_TOKENS: 'custom_tokens'
};

const BALANCE_CACHE_PREFIX = 'balance-cache-';

export class IndexedDBStorageProvider implements StorageProvider {
    
    async getWallets(): Promise<Wallet[]> {
        return db.getItem<Wallet[]>(DB_KEYS.WALLETS).then(res => res || []);
    }
    
    async addWallet(walletData: NewWallet): Promise<Wallet> {
        const wallets = await this.getWallets();
        const newWallet: Wallet = {
            ...walletData,
            id: crypto.randomUUID(), // Generate ID on the client for local storage
        };
        await db.setItem(DB_KEYS.WALLETS, [...wallets, newWallet]);
        return newWallet;
    }

    async removeWallet(walletId: string): Promise<void> {
        const wallets = await this.getWallets();
        const updatedWallets = wallets.filter(w => w.id !== walletId);
        return db.setItem(DB_KEYS.WALLETS, updatedWallets);
    }
    
    async getCustomNetworks(): Promise<EVMNetwork[]> {
        return db.getItem<EVMNetwork[]>(DB_KEYS.CUSTOM_NETWORKS).then(res => res || []);
    }

    async addCustomNetwork(networkData: NewEVMNetwork): Promise<EVMNetwork> {
        const networks = await this.getCustomNetworks();
        const newNetwork: EVMNetwork = {
            ...networkData,
            id: crypto.randomUUID(),
            isCustom: true
        };
        await db.setItem(DB_KEYS.CUSTOM_NETWORKS, [...networks, newNetwork]);
        return newNetwork;
    }
    
    async removeCustomNetwork(networkId: string): Promise<void> {
        const networks = await this.getCustomNetworks();
        const updatedNetworks = networks.filter(n => n.id !== networkId);
        return db.setItem(DB_KEYS.CUSTOM_NETWORKS, updatedNetworks);
    }

    async getCustomTokens(): Promise<Token[]> {
        return db.getItem<Token[]>(DB_KEYS.CUSTOM_TOKENS).then(res => res || []);
    }
    
    async saveAllTokens(tokens: Token[]): Promise<void> {
        // For local storage, we only care about custom tokens. The full list is always built in memory.
        const customTokens = tokens.filter(t => t.isCustom);
        return db.setItem(DB_KEYS.CUSTOM_TOKENS, customTokens);
    }

    async addCustomToken(token: Token): Promise<void> {
        const tokens = await this.getCustomTokens();
        // Avoid duplicates
        if (!tokens.find(t => t.id === token.id)) {
            await db.setItem(DB_KEYS.CUSTOM_TOKENS, [...tokens, token]);
        }
    }

    async removeCustomToken(tokenId: string): Promise<void> {
        const tokens = await this.getCustomTokens();
        const updatedTokens = tokens.filter(t => t.id !== tokenId);
        return db.setItem(DB_KEYS.CUSTOM_TOKENS, updatedTokens);
    }
    
    async getCachedBalances(walletId: string): Promise<{ balances: Balance[], timestamp: number } | undefined> {
        return db.getItem<{ balances: Balance[], timestamp: number }>(`${BALANCE_CACHE_PREFIX}${walletId}`);
    }
    
    async cacheBalances(walletId: string, balances: Balance[]): Promise<void> {
        return db.setItem(`${BALANCE_CACHE_PREFIX}${walletId}`, { balances, timestamp: Date.now() });
    }
    
    async clearCachedBalances(walletId: string): Promise<void> {
        return db.removeItem(`${BALANCE_CACHE_PREFIX}${walletId}`);
    }
}
