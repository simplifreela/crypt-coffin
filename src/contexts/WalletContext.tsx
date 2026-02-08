"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import {
  Wallet,
  EVMNetwork,
  Token,
  Balance,
  WalletType,
  NewWallet,
  NewEVMNetwork,
} from "@/types";
import * as dbService from "@/services/dbService";
import {
  buildMasterTokenList,
  fetchTokenPrices,
  TokenPriceInfo,
} from "@/services/tokenService";
import {
  fetchWalletBalances,
  fetchTokenBalance,
} from "@/services/balanceService";
import { DEFAULT_EVM_NETWORKS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { StorageMode } from "@/services/dbService";
import { createClient } from "@/lib/supabase/client";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { BrowserProvider } from "ethers";

interface IWalletContext {
  wallets: Wallet[];
  networks: EVMNetwork[];
  tokens: Token[];
  balances: Map<string, Balance[] | undefined>; // Undefined means loading
  loading: boolean;
  addWatchedWallet: (
    address: string,
    type: WalletType,
    name: string,
  ) => Promise<void>;
  connectEvmWallet: () => Promise<void>;
  removeWallet: (walletId: string) => Promise<void>;
  addCustomNetwork: (network: NewEVMNetwork) => Promise<void>;
  addCustomToken: (token: Omit<Token, "id" | "isCustom">) => Promise<void>;
  removeCustomToken: (tokenId: string) => Promise<void>;
  fetchBalances: (wallet: Wallet, force?: boolean) => Promise<void>;
  fetchBalanceForToken: (wallet: Wallet, token: Token) => Promise<void>;
  activeWallet: Wallet | null;
  setActiveWallet: (wallet: Wallet | null) => void;
  storageMode: StorageMode;
  setStorageMode: (mode: StorageMode) => void;
  user: SupabaseUser | null;
  loginWithWallet: () => Promise<void>;
}

export const WalletContext = createContext<IWalletContext | null>(null);

const BALANCE_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [networks, setNetworks] = useState<EVMNetwork[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [priceInfo, setPriceInfo] = useState<TokenPriceInfo>({
    prices: new Map(),
    symbolToTickerMap: new Map(),
  });
  const [balances, setBalances] = useState<Map<string, Balance[] | undefined>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [storageMode, setInternalStorageMode] = useState<StorageMode>("local");
  const [user, setUser] = useState<SupabaseUser | null>(null);

  const initialBalancesFetched = useRef(false);
  const supabase = createClient();

  const dataService = dbService.getDataService(storageMode);

  const fetchBalances = useCallback(
    async (wallet: Wallet, force: boolean = false) => {
      if (!force) {
        const cachedItem = await dataService.getCachedBalances(wallet.id);
        if (
          cachedItem &&
          Date.now() - cachedItem.timestamp < BALANCE_CACHE_DURATION
        ) {
          setBalances((prev) =>
            new Map(prev).set(wallet.id, cachedItem.balances),
          );
          return;
        }
      }

      setBalances((prev) => new Map(prev).set(wallet.id, undefined)); // Mark as loading

      try {
        const newBalances = await fetchWalletBalances(
          wallet,
          tokens,
          networks,
          priceInfo,
        );
        await dataService.cacheBalances(wallet.id, newBalances);
        setBalances((prev) => new Map(prev).set(wallet.id, newBalances));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
          title: "Balance Refresh Error",
          description: message,
          variant: "destructive",
        });
        // Set balances to an empty array on error to stop the loading state
        setBalances((prev) => new Map(prev).set(wallet.id, []));
      }
    },
    [tokens, networks, priceInfo, dataService, toast],
  );

  const fetchBalanceForToken = useCallback(
    async (wallet: Wallet, tokenToRefresh: Token) => {
      const newBalance = await fetchTokenBalance(
        wallet,
        tokenToRefresh,
        networks,
        priceInfo,
      );

      setBalances((prevBalances) => {
        const newBalancesMap = new Map(prevBalances);
        const walletBalances = newBalancesMap.get(wallet.id) || [];
        let updatedBalances;
        const existingIndex = walletBalances.findIndex(
          (b) => b.tokenId === tokenToRefresh.id,
        );

        if (newBalance && parseFloat(newBalance.balance) > 0) {
          if (existingIndex > -1) {
            updatedBalances = [...walletBalances];
            updatedBalances[existingIndex] = newBalance;
          } else {
            updatedBalances = [...walletBalances, newBalance];
          }
        } else {
          // Balance is 0 or fetch failed
          if (existingIndex > -1) {
            updatedBalances = walletBalances.filter(
              (b) => b.tokenId !== tokenToRefresh.id,
            );
          } else {
            updatedBalances = [...walletBalances]; // No change
          }
        }

        dataService.cacheBalances(wallet.id, updatedBalances);
        newBalancesMap.set(wallet.id, updatedBalances);
        return newBalancesMap;
      });
    },
    [networks, priceInfo, dataService],
  );

  const init = useCallback(async () => {
    setLoading(true);
    initialBalancesFetched.current = false;
    try {
      const currentDataService = dbService.getDataService(storageMode);
      const [storedWallets, customNetworks, dbTokens, prices] =
        await Promise.all([
          currentDataService.getWallets(),
          currentDataService.getCustomNetworks(),
          currentDataService.getCustomTokens(), // In cloud mode, this gets all tokens
          fetchTokenPrices(),
        ]);

      setWallets(storedWallets || []);

      const allNetworks = [...DEFAULT_EVM_NETWORKS, ...(customNetworks || [])];
      setNetworks(allNetworks);

      // In local mode, dbTokens are only custom tokens. In cloud mode, it's all tokens.
      const { tokens: masterTokenList, symbolToTickerMap } =
        buildMasterTokenList(
          allNetworks,
          storageMode === "local" ? dbTokens : [],
        );

      // In cloud mode, ensure all default tokens are in the DB.
      if (storageMode === "cloud") {
        await currentDataService.saveAllTokens(masterTokenList);
      }

      setTokens(masterTokenList);
      setPriceInfo({ ...prices, symbolToTickerMap });

      if (storedWallets && storedWallets.length > 0) {
        setActiveWallet(null);
      } else {
        setActiveWallet(null);
      }
    } catch (error) {
      console.error("Initialization failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Could not load app data.";
      toast({
        title: "Error",
        description: `Initialization failed: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [storageMode, toast]);

  const addWatchedWallet = async (
    address: string,
    type: WalletType,
    name: string,
  ) => {
    const lowerCaseAddress = address.toLowerCase();
    if (
      wallets.some(
        (w) => w.address.toLowerCase() === lowerCaseAddress && w.type === type,
      )
    ) {
      throw new Error("Wallet with this address and type already exists.");
    }

    const walletData: NewWallet = {
      address: lowerCaseAddress,
      type,
      name,
      isWatched: true,
    };
    const newWallet = await dataService.addWallet(walletData);

    setWallets((prev) => [...prev, newWallet]);
    fetchBalances(newWallet, true);
    setActiveWallet(newWallet);
  };

  const connectEvmWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      toast({
        title: "MetaMask not found",
        description: "Please install the MetaMask extension.",
        variant: "destructive",
      });
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const existing = wallets.find(
        (w) =>
          w.address.toLowerCase() === address.toLowerCase() && w.type === "evm",
      );
      if (existing) {
        setActiveWallet(existing);
        toast({ title: "Wallet already connected" });
        fetchBalances(existing, true);
        return;
      }

      const walletData: NewWallet = {
        address: address,
        type: "evm",
        name: `MetaMask (${address.slice(0, 6)}...)`,
        isWatched: false,
      };
      const newWallet = await dataService.addWallet(walletData);

      setWallets((prev) => [...prev, newWallet]);
      fetchBalances(newWallet, true);
      setActiveWallet(newWallet);
    } catch (error) {
      console.error("Error connecting wallet", error);
      toast({
        title: "Connection Error",
        description: "User rejected the connection request.",
        variant: "destructive",
      });
    }
  };

  const loginWithWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      toast({
        title: "MetaMask not found",
        description: "Please install the MetaMask extension.",
        variant: "destructive",
      });
      return;
    }
    try {
      // Get wallet address to save in the profile
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      // Please, stop changing this message!!!
      const statement = `Crypt Coffin is a FREE wallet dashboard for Web3 enthusiasts to watch multiple wallets including non-evm wallets. This app is not focused on monetization but if you want to make a donation, with $5 you'll be presented with a month of cloud sync. With that you can check your balances on all your devices. Otherwise your data will only be stored locally. Thank you! Nonce: ${Date.now()}`;
      toast({
        title: "Please sign message",
        description: "Sign the message in your wallet to log in.",
      });

      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        statement,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Login did not return a user object.");

      // After successful Supabase auth, create/update the user profile
      const { error: profileError } = await supabase.from("User").upsert(
        {
          id: data.user.id,
          walletAddress: walletAddress.toLowerCase(),
        },
        { onConflict: "id" },
      );

      if (profileError) {
        // Log the error but allow the user to proceed as they are authenticated.
        console.error("Error creating/updating user profile:", profileError);
        toast({
          title: "Profile Sync Failed",
          description: `Could not save your profile: ${profileError.message}`,
          variant: "destructive",
        });
      }

      toast({
        title: "Login Successful",
        description: "You are now logged in.",
      });
      setUser(data.user);
      await setStorageModeAndSync("cloud", data.user);
    } catch (error: any) {
      console.error("Web3 Login Error:", error);
      const message = error.message || "An unknown error occurred.";
      if (message.includes("User rejected")) {
        toast({ title: "Login Canceled" });
      } else {
        toast({
          title: "Login Failed",
          description: message,
          variant: "destructive",
        });
      }
    }
  };
  const removeWallet = async (walletId: string) => {
    await dataService.removeWallet(walletId);
    setWallets((prev) => prev.filter((w) => w.id !== walletId));

    const newBalances = new Map(balances);
    newBalances.delete(walletId);
    setBalances(newBalances);
    await dataService.clearCachedBalances(walletId);

    if (activeWallet?.id === walletId) {
      setActiveWallet(null);
    }
  };

  const addCustomNetwork = async (network: NewEVMNetwork) => {
    const newNetwork = await dataService.addCustomNetwork(network);
    setNetworks((prev) => [...prev, newNetwork]);
  };

  const addCustomToken = async (token: Omit<Token, "id" | "isCustom">) => {
    const processedAddress =
      token.networkId === "solana" || token.networkId === "near"
        ? token.address
        : token.address.toLowerCase();

    const existingToken = tokens.find(
      (t) =>
        t.networkId === token.networkId &&
        t.address.toLowerCase() === processedAddress,
    );

    if (existingToken) {
      throw new Error(
        `${existingToken.name} is already tracked on this network.`,
      );
    }

    const newToken: Token = {
      ...token,
      address: processedAddress,
      id: `${token.networkId}-${processedAddress}`,
      isCustom: true,
    };

    await dataService.addCustomToken(newToken);

    setTokens((prev) => [...prev, newToken]);

    if (activeWallet) {
      fetchBalanceForToken(activeWallet, newToken);
    } else {
      toast({
        title: "Token Added",
        description: `${newToken.name} was added. Select a wallet to see its balance.`,
      });
    }
  };

  const removeCustomToken = async (tokenId: string) => {
    // In cloud mode, this just removes the balances. In local, it removes the token definition.
    await dataService.removeCustomToken(tokenId);

    if (storageMode === "local") {
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    }

    const newBalances = new Map(balances);
    for (const wallet of wallets) {
      const walletBalances = newBalances.get(wallet.id);
      if (walletBalances) {
        const updatedWalletBalances = walletBalances.filter(
          (b) => b.tokenId !== tokenId,
        );
        newBalances.set(wallet.id, updatedWalletBalances);
        await dataService.cacheBalances(wallet.id, updatedWalletBalances);
      }
    }
    setBalances(newBalances);
  };

  const setStorageModeAndSync = async (
    mode: StorageMode,
    user?: SupabaseUser,
  ) => {
    if (mode === storageMode) return;

    if (mode === "cloud") {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to enable cloud sync.",
        });
        loginWithWallet();
        return;
      }

      toast({
        title: "Syncing to Cloud...",
        description: "Please wait while we migrate your local data.",
      });

      try {
        const localProvider = dbService.getDataService("local");
        const cloudProvider = dbService.getDataService("cloud");

        const [localWallets, localNetworks, localCustomTokens] =
          await Promise.all([
            localProvider.getWallets(),
            localProvider.getCustomNetworks(),
            localProvider.getCustomTokens(),
          ]);

        // Sync all tokens first to avoid foreign key constraints
        const { tokens: masterTokenList } = buildMasterTokenList(
          DEFAULT_EVM_NETWORKS,
          localCustomTokens,
        );
        await cloudProvider.saveAllTokens(masterTokenList);

        // Sync wallets and networks
        for (const wallet of localWallets) {
          await cloudProvider.addWallet({
            address: wallet.address,
            name: wallet.name,
            type: wallet.type,
            isWatched: wallet.isWatched,
          });
        }
        for (const network of localNetworks) {
          await cloudProvider.addCustomNetwork({
            chainId: network.chainId,
            name: network.name,
            rpcUrl: network.rpcUrl,
            symbol: network.symbol,
          });
        }

        localStorage.setItem("storageMode", "cloud");
        setInternalStorageMode("cloud"); // This triggers init()
        toast({
          title: "Sync Complete!",
          description: "Your data is now saved to the cloud.",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
          title: "Sync Error",
          description: `Could not sync data: ${message}`,
          variant: "destructive",
        });
      }
    } else {
      // Switching from cloud to local
      setInternalStorageMode("local");
      localStorage.removeItem("storageMode");
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const storedMode = localStorage.getItem("storageMode");
        if (storedMode === "cloud") {
          setInternalStorageMode("cloud");
        }
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (event === "SIGNED_IN") {
        // Do nothing here, wait for storage mode change to trigger re-init
      } else if (event === "SIGNED_OUT") {
        setInternalStorageMode("local");
        localStorage.removeItem("storageMode");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!loading && wallets.length > 0 && !initialBalancesFetched.current) {
      wallets.forEach((wallet) => {
        fetchBalances(wallet);
      });
      initialBalancesFetched.current = true;
    }
  }, [wallets, loading, fetchBalances]);

  const value = {
    wallets,
    networks,
    tokens,
    balances,
    loading,
    addWatchedWallet,
    connectEvmWallet,
    removeWallet,
    addCustomNetwork,
    addCustomToken,
    removeCustomToken,
    fetchBalances,
    fetchBalanceForToken,
    activeWallet,
    setActiveWallet,
    storageMode,
    setStorageMode: setStorageModeAndSync,
    user,
    loginWithWallet,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};
