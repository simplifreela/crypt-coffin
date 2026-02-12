"use client";

import * as db from '@/lib/db';
import type { Wallet, EVMNetwork, Token, Balance, NewWallet, NewEVMNetwork, PortfolioOverview, NewPortfolioOverview } from '@/types';
import type { StorageProvider } from './types';

const DB_KEYS = {
    WALLETS: 'wallets',
    CUSTOM_NETWORKS: 'custom_networks',
    CUSTOM_TOKENS: 'custom_tokens',
    PORTFOLIO_OVERVIEWS: 'portfolio_overviews'
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

    async updateWallet(walletId: string, updates: Partial<Wallet>): Promise<Wallet> {
        const wallets = await this.getWallets();
        const index = wallets.findIndex(w => w.id === walletId);
        if (index === -1) throw new Error("Wallet not found");
        
        const updatedWallet = { ...wallets[index], ...updates };
        const updatedWallets = [...wallets];
        updatedWallets[index] = updatedWallet;
        
        await db.setItem(DB_KEYS.WALLETS, updatedWallets);
        return updatedWallet;
    }

    async updateCustomNetwork(networkId: string, updates: Partial<EVMNetwork>): Promise<EVMNetwork> {
        const networks = await this.getCustomNetworks();
        const index = networks.findIndex(n => n.id === networkId);
        if (index === -1) throw new Error("Network not found");
        
        const updatedNetwork = { ...networks[index], ...updates };
        const updatedNetworks = [...networks];
        updatedNetworks[index] = updatedNetwork;
        
        await db.setItem(DB_KEYS.CUSTOM_NETWORKS, updatedNetworks);
        return updatedNetwork;
    }

    async getPortfolioOverviews(): Promise<PortfolioOverview[]> {
        return db.getItem<PortfolioOverview[]>(DB_KEYS.PORTFOLIO_OVERVIEWS).then(res => res || []);
    }

    async addPortfolioOverview(overview: NewPortfolioOverview): Promise<PortfolioOverview> {
        const overviews = await this.getPortfolioOverviews();
        const newOverview: PortfolioOverview = {
            ...overview,
            id: crypto.randomUUID(),
            userId: "", // Local mode doesn't use userId
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await db.setItem(DB_KEYS.PORTFOLIO_OVERVIEWS, [...overviews, newOverview]);
        return newOverview;
    }

    async updatePortfolioOverview(overviewId: string, updates: Partial<PortfolioOverview>): Promise<PortfolioOverview> {
        const overviews = await this.getPortfolioOverviews();
        const index = overviews.findIndex(o => o.id === overviewId);
        if (index === -1) throw new Error("Portfolio overview not found");
        
        const updatedOverview = { 
            ...overviews[index], 
            ...updates,
            updatedAt: new Date().toISOString()
        };
        const updatedOverviews = [...overviews];
        updatedOverviews[index] = updatedOverview;
        
        await db.setItem(DB_KEYS.PORTFOLIO_OVERVIEWS, updatedOverviews);
        return updatedOverview;
    }

    async removePortfolioOverview(overviewId: string): Promise<void> {
        const overviews = await this.getPortfolioOverviews();
        const updatedOverviews = overviews.filter(o => o.id !== overviewId);
        return db.setItem(DB_KEYS.PORTFOLIO_OVERVIEWS, updatedOverviews);
    }
