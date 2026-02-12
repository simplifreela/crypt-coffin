import { Wallet, Token, Balance, EVMNetwork } from "@/types";
import { formatUnits } from "ethers";
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

export class SolanaBalanceProvider implements BalanceProvider {
  private readonly solanaRpcUrl = "https://solana-rpc.publicnode.com";

  supportsWalletType(type: string): boolean {
    return type === "solana";
  }

  async fetchWalletBalances(
    wallet: Wallet,
    tokens: Token[],
    _networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance[]> {
    const newBalances: Balance[] = [];

    // Fetch native SOL balance
    try {
      const response = await fetch(this.solanaRpcUrl, {
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
      let solPrice = getPrice("SOL", priceInfo);
      if (!solPrice || solPrice === 0) {
        solPrice = await getPriceWithFallback("SOL", priceInfo);
      }

      if (solBalance > 0.00000001) {
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

    // Fetch SPL token balances in parallel
    const solanaTokens = tokens.filter(
      (t) => t.networkId === "solana" && t.address !== ZERO_ADDRESS,
    );

    const tokenPromises = solanaTokens.map(async (token) => {
      try {
        const response = await fetch(this.solanaRpcUrl, {
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

        if (totalBalance > 0.00000001) {
          return {
            id: `${wallet.id}-${token.id}`,
            walletId: wallet.id,
            tokenId: token.id,
            userId: null,
            balance: totalBalance.toFixed(4),
            balanceUSD: (totalBalance * price).toFixed(2),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            previousBalances: [],
          };
        }
      } catch (tokenError) {
        console.error(
          `Failed to fetch balance for SPL token ${token.name}`,
          tokenError,
        );
      }
      return null;
    });

    const tokenBalances = await Promise.all(tokenPromises);
    newBalances.push(...tokenBalances.filter((b) => b !== null));

    return newBalances;
  }

  async fetchTokenBalance(
    wallet: Wallet,
    token: Token,
    _networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance | null> {
    if (wallet.type !== "solana" || token.networkId !== "solana") return null;

    const balances = await this.fetchWalletBalances(
      wallet,
      [token],
      [],
      priceInfo,
    );
    return balances.find((b) => b.tokenId === token.id) || null;
  }
}
