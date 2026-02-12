"use client";

import { Wallet, Token, Balance, EVMNetwork } from "@/types";
import { JsonRpcProvider, Contract, formatUnits, formatEther } from "ethers";
import { TokenPriceInfo } from "./tokenService";
import { ZERO_ADDRESS } from "@/lib/constants";

const getPrice = (
  symbol: string,
  { prices, symbolToTickerMap }: TokenPriceInfo,
): number => {
  const ticker =
    symbolToTickerMap.get(symbol.toUpperCase()) || symbol.toUpperCase();
  return prices.get(ticker) || 0;
};

async function fetchBtcBalance(
  wallet: Wallet,
  priceInfo: TokenPriceInfo,
): Promise<Balance[]> {
  try {
    const response = await fetch(
      `https://blockchain.info/q/addressbalance/${wallet.address}`,
    );
    if (!response.ok)
      throw new Error(`Failed to fetch balance: ${response.statusText}`);

    const satoshis = await response.text();
    const btcBalance = parseInt(satoshis, 10) / 100_000_000;
    const btcPrice = getPrice("BTC", priceInfo);

    if (btcBalance > 0) {
      const tokenId = `btc-${ZERO_ADDRESS}`;
      return [
        {
          id: `${wallet.id}-${tokenId}`,
          walletId: wallet.id,
          tokenId: tokenId,
          userId: null,
          balance: btcBalance.toFixed(8),
          balanceUSD: (btcBalance * btcPrice).toFixed(2),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          previousBalances: [],
        },
      ];
    }
  } catch (error) {
    console.error("Failed to fetch bitcoin balance", error);
  }
  return [];
}

async function fetchNearBalances(
  wallet: Wallet,
  tokens: Token[],
  priceInfo: TokenPriceInfo,
): Promise<Balance[]> {
  const newBalances: Balance[] = [];
  try {
    const response = await fetch("https://1rpc.io/near", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: wallet.address,
        },
      }),
    });
    if (!response.ok) throw new Error(`NEAR RPC error: ${response.statusText}`);
    const rpcResponse = await response.json();
    if (rpcResponse.error) {
      throw new Error(
        rpcResponse.error.data ||
          rpcResponse.error.message ||
          "Failed to fetch account.",
      );
    }
    const amountYocto = rpcResponse.result.amount;
    const nearBalance = parseInt(amountYocto, 10) / 1e24;
    const nearPrice = getPrice("NEAR", priceInfo);

    if (nearBalance > 0) {
      const tokenId = `near-${ZERO_ADDRESS}`;
      newBalances.push({
        id: `${wallet.id}-${tokenId}`,
        walletId: wallet.id,
        tokenId,
        userId: null,
        balance: nearBalance.toFixed(5),
        balanceUSD: (nearBalance * nearPrice).toFixed(2),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previousBalances: [],
      });
    }
  } catch (error) {
    console.error("Failed to fetch NEAR balance", error);
  }

  const nearTokens = tokens.filter(
    (t) => t.networkId === "near" && t.address !== ZERO_ADDRESS,
  );
  for (const token of nearTokens) {
    try {
      const args_base64 = btoa(JSON.stringify({ account_id: wallet.address }));
      const ftBalancePromise = fetch("https://1rpc.io/near", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: token.address,
            method_name: "ft_balance_of",
            args_base64,
          },
        }),
      }).then((res) => res.json());

      const ftMetadataPromise = fetch("https://1rpc.io/near", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: token.address,
            method_name: "ft_metadata",
            args_base64: btoa("{}"),
          },
        }),
      }).then((res) => res.json());

      const [balanceRes, metadataRes] = await Promise.all([
        ftBalancePromise,
        ftMetadataPromise,
      ]);

      if (balanceRes.error)
        throw new Error(balanceRes.error.data || "Failed to fetch balance");
      if (metadataRes.error)
        throw new Error(metadataRes.error.data || "Failed to fetch metadata");

      const balanceRaw = JSON.parse(
        new TextDecoder().decode(new Uint8Array(balanceRes.result.result)),
      );
      const metadata = JSON.parse(
        new TextDecoder().decode(new Uint8Array(metadataRes.result.result)),
      );
      const decimals = metadata.decimals;

      const balance = formatUnits(balanceRaw, decimals);

      const price = getPrice(token.symbol, priceInfo);

      if (parseFloat(balance) > 0) {
        newBalances.push({
          id: `${wallet.id}-${token.id}`,
          walletId: wallet.id,
          tokenId: token.id,
          userId: null,
          balance: parseFloat(balance).toFixed(4),
          balanceUSD: (parseFloat(balance) * price).toFixed(2),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          previousBalances: [],
        });
      }
    } catch (tokenError) {
      console.error(
        `Failed to fetch balance for NEAR token ${token.name}`,
        tokenError,
      );
    }
  }
  return newBalances;
}

async function fetchSolanaBalances(
  wallet: Wallet,
  tokens: Token[],
  priceInfo: TokenPriceInfo,
): Promise<Balance[]> {
  const newBalances: Balance[] = [];
  const solanaRpcUrl = "https://solana-rpc.publicnode.com";
  try {
    const response = await fetch(solanaRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [wallet.address],
      }),
    });
    const rpcResponse = await response.json();
    if (rpcResponse.error) throw new Error(rpcResponse.error.message);

    const lamports = rpcResponse.result.value;
    const solBalance = lamports / 1e9;
    const solPrice = getPrice("SOL", priceInfo);

    if (solBalance > 0) {
      const tokenId = `solana-${ZERO_ADDRESS}`;
      newBalances.push({
        id: `${wallet.id}-${tokenId}`,
        walletId: wallet.id,
        tokenId,
        userId: null,
        balance: solBalance.toFixed(4),
        balanceUSD: (solBalance * solPrice).toFixed(2),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        previousBalances: [],
      });
    }
  } catch (error) {
    console.error("Failed to fetch SOL balance", error);
  }
  const solanaTokens = tokens.filter(
    (t) => t.networkId === "solana" && t.address !== ZERO_ADDRESS,
  );
  for (const token of solanaTokens) {
    try {
      const response = await fetch(solanaRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            wallet.address,
            { mint: token.address },
            { encoding: "jsonParsed" },
          ],
        }),
      });
      const rpcResponse = await response.json();
      if (rpcResponse.error) throw new Error(rpcResponse.error.message);

      let totalBalance = 0;
      if (rpcResponse.result.value) {
        rpcResponse.result.value.forEach((account: any) => {
          totalBalance += account.account.data.parsed.info.tokenAmount.uiAmount;
        });
      }

      const price = getPrice(token.symbol, priceInfo);

      if (totalBalance > 0) {
        newBalances.push({
          id: `${wallet.id}-${token.id}`,
          walletId: wallet.id,
          tokenId: token.id,
          userId: null,
          balance: totalBalance.toFixed(4),
          balanceUSD: (totalBalance * price).toFixed(2),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          previousBalances: [],
        });
      }
    } catch (tokenError) {
      console.error(
        `Failed to fetch balance for SPL token ${token.name}`,
        tokenError,
      );
    }
  }
  return newBalances;
}

async function fetchEvmBalances(
  wallet: Wallet,
  tokens: Token[],
  networks: EVMNetwork[],
  priceInfo: TokenPriceInfo,
): Promise<Balance[]> {
  const newBalances: Balance[] = [];
  const erc20Abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];
  for (const network of networks) {
    try {
      const provider = new JsonRpcProvider(network.rpcUrl);

      const nativeBalanceWei = await provider.getBalance(wallet.address);
      const nativeBalance = formatEther(nativeBalanceWei);
      const nativePrice = getPrice(network.symbol, priceInfo);

      if (parseFloat(nativeBalance) > 0) {
        const tokenId = `${network.id}-${ZERO_ADDRESS}`;
        newBalances.push({
          id: `${wallet.id}-${tokenId}`,
          walletId: wallet.id,
          tokenId,
          userId: null,
          balance: parseFloat(nativeBalance).toFixed(4),
          balanceUSD: (parseFloat(nativeBalance) * nativePrice).toFixed(2),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          previousBalances: [],
        });
      }

      const networkTokens = tokens.filter(
        (t) => t.networkId === network.id && t.address !== ZERO_ADDRESS,
      );

      for (const token of networkTokens) {
        try {
          const tokenContract = new Contract(token.address, erc20Abi, provider);
          const [balanceRaw, decimals] = await Promise.all([
            tokenContract.balanceOf(wallet.address),
            tokenContract.decimals(),
          ]);

          const balance = formatUnits(balanceRaw, decimals);
          const price = getPrice(token.symbol, priceInfo);

          if (parseFloat(balance) > 0) {
            newBalances.push({
              id: `${wallet.id}-${token.id}`,
              walletId: wallet.id,
              tokenId: token.id,
              userId: null,
              balance: parseFloat(balance).toFixed(4),
              balanceUSD: (parseFloat(balance) * price).toFixed(2),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              previousBalances: [],
            });
          }
        } catch (tokenError) {
          console.error(
            `Failed to fetch balance for ERC20 token ${token.name} on ${network.name}`,
            tokenError,
          );
        }
      }
    } catch (networkError) {
      console.error(
        `Failed to fetch balances on ${network.name}`,
        networkError,
      );
    }
  }
  return newBalances;
}

export const fetchWalletBalances = async (
  wallet: Wallet,
  tokens: Token[],
  networks: EVMNetwork[],
  priceInfo: TokenPriceInfo,
): Promise<Balance[]> => {
  switch (wallet.type) {
    case "btc":
      return fetchBtcBalance(wallet, priceInfo);
    case "near":
      return fetchNearBalances(wallet, tokens, priceInfo);
    case "solana":
      return fetchSolanaBalances(wallet, tokens, priceInfo);
    case "evm":
      return fetchEvmBalances(wallet, tokens, networks, priceInfo);
    default:
      return [];
  }
};

export const fetchTokenBalance = async (
  wallet: Wallet,
  token: Token,
  networks: EVMNetwork[],
  priceInfo: TokenPriceInfo,
): Promise<Balance | null> => {
  let newBalanceValue = "0.0000";
  let newBalanceUsd = "0.00";
  const price = getPrice(token.symbol, priceInfo);

  try {
    if (wallet.type === "btc" && token.symbol === "BTC") {
      const balances = await fetchBtcBalance(wallet, priceInfo);
      return balances[0] || null;
    } else if (wallet.type === "near" && token.networkId === "near") {
      const balances = await fetchNearBalances(wallet, [token], priceInfo);
      return balances.find((b) => b.tokenId === token.id) || null;
    } else if (wallet.type === "solana" && token.networkId === "solana") {
      const balances = await fetchSolanaBalances(wallet, [token], priceInfo);
      return balances.find((b) => b.tokenId === token.id) || null;
    } else if (wallet.type === "evm") {
      const network = networks.find((n) => n.id === token.networkId);
      if (!network) throw new Error("Network not found for token");

      const provider = new JsonRpcProvider(network.rpcUrl);

      if (token.address === ZERO_ADDRESS) {
        const nativeBalanceWei = await provider.getBalance(wallet.address);
        const nativeBalance = formatEther(nativeBalanceWei);
        newBalanceValue = parseFloat(nativeBalance).toFixed(4);
      } else {
        const erc20Abi = [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)",
        ];
        const tokenContract = new Contract(token.address, erc20Abi, provider);
        const [balanceRaw, decimals] = await Promise.all([
          tokenContract.balanceOf(wallet.address),
          tokenContract.decimals(),
        ]);
        const balance = formatUnits(balanceRaw, decimals);
        newBalanceValue = parseFloat(balance).toFixed(4);
      }
      newBalanceUsd = (parseFloat(newBalanceValue) * price).toFixed(2);
      if (parseFloat(newBalanceValue) > 0) {
        return {
          id: `${wallet.id}-${token.id}`,
          walletId: wallet.id,
          tokenId: token.id,
          userId: null,
          balance: newBalanceValue,
          balanceUSD: newBalanceUsd,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          previousBalances: [],
        };
      }
    }
  } catch (error) {
    console.error(`Failed to refresh balance for ${token.symbol}`, error);
  }
  return null;
};
