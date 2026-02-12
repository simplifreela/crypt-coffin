import { Wallet, Token, Balance, EVMNetwork } from "@/types";
import { JsonRpcProvider, Contract, formatUnits, formatEther } from "ethers";
import { TokenPriceInfo } from "../tokenService";
import type { BalanceProvider } from "./types";
import { ZERO_ADDRESS } from "@/lib/constants";

const getPrice = (
  symbol: string,
  { prices, symbolToTickerMap }: TokenPriceInfo,
): number => {
  const ticker = symbolToTickerMap.get(symbol.toUpperCase()) || symbol.toUpperCase();
  return prices.get(ticker) || 0;
};

const getPriceWithFallback = async (
  symbol: string,
  priceInfo: TokenPriceInfo,
): Promise<number> => {
  const p = getPrice(symbol, priceInfo);
  if (p && p > 0) return p;
  try {
    const res = await fetch("/api/tokens");
    const cmc = await res.json();
    if (cmc && !cmc.error) {
      const found = cmc.find((t: any) => t.symbol && t.symbol.toUpperCase() === symbol.toUpperCase());
      if (found && found.price) return found.price;
    }
  } catch (e) {
    console.error("Price fallback fetch failed:", e);
  }
  return 0;
};

export class EVMBalanceProvider implements BalanceProvider {
  supportsWalletType(type: string): boolean {
    return type === "evm";
  }

  async fetchWalletBalances(
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

    // Fetch balances for all networks in parallel
    const networkPromises = networks.map(async (network) => {
      try {
        const provider = new JsonRpcProvider(network.rpcUrl);
        const balances: Balance[] = [];

        // Fetch native token balance
        const nativeBalanceWei = await provider.getBalance(wallet.address);
        const nativeBalance = formatEther(nativeBalanceWei);
        const nativePrice = getPrice(network.symbol, priceInfo);

        if (parseFloat(nativeBalance) > 0) {
          const tokenId = `${network.id}-${ZERO_ADDRESS}`;
          balances.push({
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

        // Fetch ERC20 tokens in parallel
        const networkTokens = tokens.filter(
          (t) => t.networkId === network.id && t.address !== ZERO_ADDRESS,
        );

        const tokenPromises = networkTokens.map(async (token) => {
          try {
            const tokenContract = new Contract(token.address, erc20Abi, provider);
            const [balanceRaw, decimals] = await Promise.all([
              tokenContract.balanceOf(wallet.address),
              tokenContract.decimals(),
            ]);

            const balance = formatUnits(balanceRaw, decimals);
            const price = getPrice(token.symbol, priceInfo);

            if (parseFloat(balance) > 0) {
              return {
                id: `${wallet.id}-${token.id}`,
                walletId: wallet.id,
                tokenId: token.id,
                userId: null,
                balance: parseFloat(balance).toFixed(4),
                balanceUSD: (parseFloat(balance) * price).toFixed(2),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                previousBalances: [],
              };
            }
          } catch (tokenError) {
            console.error(
              `Failed to fetch balance for ERC20 token ${token.name} on ${network.name}`,
              tokenError,
            );
          }
          return null;
        });

        const tokenBalances = await Promise.all(tokenPromises);
        balances.push(...tokenBalances.filter((b) => b !== null));
        return balances;
      } catch (networkError) {
        console.error(`Failed to fetch balances on ${network.name}`, networkError);
        return [];
      }
    });

    const allNetworkBalances = await Promise.all(networkPromises);
    allNetworkBalances.forEach((balances) => newBalances.push(...balances));

    return newBalances;
  }

  async fetchTokenBalance(
    wallet: Wallet,
    token: Token,
    networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance | null> {
    if (wallet.type !== "evm") return null;

    const network = networks.find((n) => n.id === token.networkId);
    if (!network) throw new Error("Network not found for token");

    try {
      const provider = new JsonRpcProvider(network.rpcUrl);
      let newBalanceValue = "0.0000";
      let newBalanceUsd = "0.00";
      let price = getPrice(token.symbol, priceInfo);
      if (!price || price === 0) {
        price = await getPriceWithFallback(token.symbol, priceInfo);
      }

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
    } catch (error) {
      console.error(`Failed to refresh balance for ${token.symbol}`, error);
    }

    return null;
  }
}
