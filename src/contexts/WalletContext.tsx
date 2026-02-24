import { BigNumber } from "bignumber.js";

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
  PortfolioOverview,
} from "@/types";
import * as dbService from "@/services/dbService";
import {
  buildMasterTokenList,
  fetchTokenPrices,
  TokenPriceInfo,
} from "@/services/tokenService";
import { balanceService } from "@/services/balance";
import { DEFAULT_EVM_NETWORKS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { StorageMode } from "@/services/dbService";
import { createClient } from "@/lib/supabase/client";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { getAdapter } from "@/services/walletAdapter";
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
  connectWallet: (providerId: string) => Promise<void>;
  /**
   * @deprecated use connectWallet('evm')
   * @returns
   */
  connectEvmWallet: () => Promise<void>;
  removeWallet: (walletId: string) => Promise<void>;
  renameWallet: (walletId: string, newName: string) => Promise<void>;
  addCustomNetwork: (network: NewEVMNetwork) => Promise<void>;
  getPortfolioOverviews: () => Promise<PortfolioOverview[]>;
  addPortfolioOverview: (overview: {
    name: string;
    description?: string;
    walletIds: string[];
  }) => Promise<any>;
  updatePortfolioOverview: (
    overviewId: string,
    updates: Partial<any>,
  ) => Promise<PortfolioOverview>;
  removePortfolioOverview: (overviewId: string) => Promise<void>;
  updateCustomNetwork: (
    networkId: string,
    updates: { name?: string; rpcUrl?: string },
  ) => Promise<void>;
  removeCustomNetwork: (networkId: string) => Promise<void>;
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
  const [overviews, setOverviews] = useState<any[]>([]);

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
          // Validate that all cached balance tokenIds exist in the current token list.
          // If any are orphaned (e.g., after token table wipe), skip cache and fetch fresh.
          const allTokenIdsValid = cachedItem.balances.every((b) =>
            tokens.some((t) => t.id === b.tokenId),
          );

          if (allTokenIdsValid) {
            setBalances((prev) =>
              new Map(prev).set(wallet.id, cachedItem.balances),
            );
            return;
          } else {
            console.warn(
              `Skipping stale cache for wallet ${wallet.id}: contains orphaned token references`,
            );
          }
        }
      }

      setBalances((prev) => new Map(prev).set(wallet.id, undefined)); // Mark as loading

      try {
        const newBalances = await balanceService.fetchWalletBalances(
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
      const newBalance = await balanceService.fetchTokenBalance(
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

        if (newBalance) {
          const bn = typeof newBalance.balance === "string" ? new BigNumber(newBalance.balance) : newBalance.balance;
          if (bn.isGreaterThan(0)) {
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
        } else {
          // newBalance is null, remove from list if exists
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
    // Normalize address when possible (checksums for EVM, PublicKey for Solana)
    let saveAddress = address;
    try {
      const { normalizeAddress } = await import("@/lib/addressUtils");
      const normalized = await normalizeAddress(address, type);
      saveAddress = normalized.address;
    } catch (e) {
      // if normalization fails, fall back to the original address
      saveAddress = address;
    }

    if (
      wallets.some(
        (w) =>
          w.type === type &&
          String(w.address).toLowerCase() === String(saveAddress).toLowerCase(),
      )
    ) {
      throw new Error("Wallet with this address and type already exists.");
    }

    const walletData: NewWallet = {
      address: saveAddress,
      type,
      name,
      isWatched: true,
    };
    const newWallet = await dataService.addWallet(walletData);

    setWallets((prev) => [...prev, newWallet]);
    fetchBalances(newWallet, true);
    setActiveWallet(newWallet);
  };

  const connectWallet = async (providerId: string) => {
    try {
      const adapter = getAdapter(providerId);
      const connected = await adapter.connect();

      let address = connected.address;
      const type = connected.type;
      try {
        const { normalizeAddress } = await import("@/lib/addressUtils");
        const normalized = await normalizeAddress(address, type);
        address = normalized.address;
      } catch (e) {
        // ignore normalization errors
      }

      const existing = wallets.find(
        (w) =>
          String(w.address).toLowerCase() === String(address).toLowerCase() &&
          w.type === type,
      );
      if (existing) {
        setActiveWallet(existing);
        toast({ title: "Wallet already connected" });
        fetchBalances(existing, true);
        return;
      }

      const walletData: NewWallet = {
        address: address,
        type: type,
        name: connected.name || `Connected (${address.slice(0, 6)}...)`,
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
        description:
          error instanceof Error ? error.message : "Connection failed",
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
          walletAddress,
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

      // Check if user has active premium (defer to setStorageModeAndSync if needed)
      try {
        const { data: userData, error: userError } = await supabase
          .from("User")
          .select("isPremium, premiumExpiresAt")
          .eq("id", data.user.id)
          .single();

        if (!userError && userData) {
          const now = new Date();
          const premiumExpires = userData.premiumExpiresAt
            ? new Date(userData.premiumExpiresAt)
            : null;
          const hasActivePremium =
            userData.isPremium && premiumExpires && premiumExpires > now;

          console.log("Premium check result:", {
            isPremium: userData.isPremium,
            premiumExpiresAt: userData.premiumExpiresAt,
            now: now.toISOString(),
            hasActivePremium,
          });

          if (hasActivePremium) {
            // Auto-enable cloud sync for premium users
            console.log("Premium user detected, will enable cloud sync");
            // Schedule cloud sync after wallets are synced
            setTimeout(() => setStorageModeAndSync("cloud", data.user), 500);
          }
        }
      } catch (e) {
        // Non-blocking: if premium check fails, user can still use local storage
        console.error("Failed to check premium status:", e);
      }

      // Auto-add/sync connected wallet to user's wallets if not present
      try {
        // Refresh wallets from storage to ensure we have latest state after storage mode change
        const currentDataService = dbService.getDataService(storageMode === "cloud" ? "cloud" : "local");
        const currentWallets = await currentDataService.getWallets();
        
        const existing = currentWallets.find(
          (w) =>
            String(w.address).toLowerCase() ===
              String(walletAddress).toLowerCase() && w.type === "evm",
        );
        if (!existing) {
          const walletData: NewWallet = {
            address: walletAddress,
            type: "evm",
            name: `MetaMask (${walletAddress.slice(0, 6)}...)`,
            isWatched: false,
          };
          const newWallet = await currentDataService.addWallet(walletData);
          setWallets((prev) => [...prev, newWallet]);
          fetchBalances(newWallet, true);
          setActiveWallet(newWallet);
        } else {
          // Wallet exists, just set as active
          setActiveWallet(existing);
        }
      } catch (e) {
        // Non-blocking
        console.error("Failed to auto-add connected wallet:", e);
      }
      // NOTE: Cloud sync is automatically enabled if user has active premium.
      // Otherwise, users can opt-in to cloud sync through the cloud sync modal after login.
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

  // Portfolio Overviews
  const getPortfolioOverviews = async () => {
    try {
      const currentDataService = dbService.getDataService(storageMode);
      const res = await currentDataService.getPortfolioOverviews();
      setOverviews(res || []);
      return res;
    } catch (e) {
      console.error("Failed to fetch overviews", e);
      return [];
    }
  };

  const addPortfolioOverview = async (overview: {
    name: string;
    description?: string;
    walletIds: string[];
  }) => {
    const currentDataService = dbService.getDataService(storageMode);
    const newOverview = await currentDataService.addPortfolioOverview(
      overview as any,
    );
    setOverviews((prev) => [...prev, newOverview]);
    return newOverview;
  };

  const updatePortfolioOverview = async (
    overviewId: string,
    updates: Partial<any>,
  ) => {
    const currentDataService = dbService.getDataService(storageMode);
    const updated = await currentDataService.updatePortfolioOverview(
      overviewId,
      updates,
    );
    setOverviews((prev) =>
      prev.map((o) => (o.id === overviewId ? updated : o)),
    );
    return updated;
  };

  const removePortfolioOverview = async (overviewId: string) => {
    const currentDataService = dbService.getDataService(storageMode);
    await currentDataService.removePortfolioOverview(overviewId);
    setOverviews((prev) => prev.filter((o) => o.id !== overviewId));
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

  const renameWallet = async (walletId: string, newName: string) => {
    const updatedWallet = await dataService.updateWallet(walletId, {
      name: newName,
    });
    setWallets((prev) =>
      prev.map((w) => (w.id === walletId ? updatedWallet : w)),
    );
  };

  const updateCustomNetwork = async (
    networkId: string,
    updates: { name?: string; rpcUrl?: string },
  ) => {
    const updatedNetwork = await dataService.updateCustomNetwork(
      networkId,
      updates,
    );
    setNetworks((prev) =>
      prev.map((n) => (n.id === networkId ? updatedNetwork : n)),
    );
  };

  const removeCustomNetwork = async (networkId: string) => {
    await dataService.removeCustomNetwork(networkId);
    setNetworks((prev) => prev.filter((n) => n.id !== networkId));
  };

  const addCustomNetwork = async (network: NewEVMNetwork) => {
    const newNetwork = await dataService.addCustomNetwork(network);
    setNetworks((prev) => [...prev, newNetwork]);
  };

  const addCustomToken = async (token: Omit<Token, "id" | "isCustom">) => {
    const processedAddress =
      token.networkId === "solana" || token.networkId === "near"
        ? token.address
        : token.address;

    const existingToken = tokens.find(
      (t) =>
        t.networkId === token.networkId &&
        String(t.address).toLowerCase() ===
          String(processedAddress).toLowerCase(),
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

        // Sync wallets and networks (addWallet handles deduplication)
        for (const wallet of localWallets) {
          try {
            await cloudProvider.addWallet({
              address: wallet.address,
              name: wallet.name,
              type: wallet.type,
              isWatched: wallet.isWatched,
            });
          } catch (e) {
            // Log but don't fail entire sync if one wallet has issues
            console.error(`Failed to sync wallet ${wallet.address}:`, e);
          }
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
    // Use onAuthStateChange as the single source of user state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (event === "SIGNED_IN") {
        // Check storage mode preference on login
        const storedMode = localStorage.getItem("storageMode");
        if (storedMode === "cloud") {
          setInternalStorageMode("cloud");
        }
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

  // Listen to MetaMask network and account changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleChainChanged = (chainIdHex: string) => {
      console.log("Chain changed to:", chainIdHex);
      // Reload or re-initialize to reflect new network
      window.location.reload();
    };

    const handleAccountsChanged = (accounts: string[]) => {
      console.log("Accounts changed:", accounts);
      if (accounts.length === 0) {
        // User disconnected wallet
        setWallets([]);
        setActiveWallet(null);
      } else {
        // Account switched, reload to ensure everything is in sync
        window.location.reload();
      }
    };

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("chainChanged", handleChainChanged);
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!loading && wallets.length > 0 && !initialBalancesFetched.current) {
      wallets.forEach((wallet) => {
        fetchBalances(wallet);
      });
      initialBalancesFetched.current = true;
    }
  }, [wallets, loading, fetchBalances]);

  // Ensure any wallets missing a balances entry get a fetch (without balances in dependencies to avoid loop)
  useEffect(() => {
    if (wallets.length === 0) return;
    for (const wallet of wallets) {
      if (!balances.has(wallet.id)) {
        // Wallet is missing from balances map, fetch it
        fetchBalances(wallet).catch((e) => {
          console.error(`Background fetch failed for wallet ${wallet.id}:`, e);
        });
      }
    }
  }, [wallets, fetchBalances]);

  const value: IWalletContext = {
    wallets,
    networks,
    tokens,
    balances,
    loading,
    addWatchedWallet,
    connectWallet,
    removeWallet,
    connectEvmWallet: () => connectWallet("evm"), // backwards compat wrapper    removeWallet,
    renameWallet,
    addCustomNetwork,
    updateCustomNetwork,
    removeCustomNetwork,
    addCustomToken,
    removeCustomToken,
    fetchBalances,
    fetchBalanceForToken,
    getPortfolioOverviews,
    addPortfolioOverview,
    updatePortfolioOverview,
    removePortfolioOverview,
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
