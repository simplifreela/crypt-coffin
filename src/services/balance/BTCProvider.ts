import { Wallet, Token, Balance, EVMNetwork } from "@/types";
import { TokenPriceInfo } from "../tokenService";
import { ZERO_ADDRESS } from "@/lib/constants";
import type { BalanceProvider } from "./types";
import { BigNumber } from "bignumber.js";

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

export class BTCBalanceProvider implements BalanceProvider {
  supportsWalletType(type: string): boolean {
    return type === "btc";
  }

  async fetchWalletBalances(
    wallet: Wallet,
    _tokens: Token[],
    _networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance[]> {
    try {
      const response = await fetch(
        `https://blockchain.info/q/addressbalance/${wallet.address}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`);
      }

      const satoshis = await response.text();
      const btcBalance = parseInt(satoshis, 10) / 100_000_000;
      let btcPrice = getPrice("BTC", priceInfo);
      if (!btcPrice || btcPrice === 0) {
        btcPrice = await getPriceWithFallback("BTC", priceInfo);
      }

      const btcBalanceBN = new BigNumber(btcBalance);
      if (btcBalanceBN.isGreaterThan(0)) {
        const tokenId = `btc-${ZERO_ADDRESS}`;
        return [
          {
            id: `${wallet.id}-${tokenId}`,
            walletId: wallet.id,
            tokenId: tokenId,
            userId: null,
            balance: btcBalanceBN,
            balanceUSD: btcBalanceBN.times(btcPrice).toFixed(2),
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

  async fetchTokenBalance(
    wallet: Wallet,
    token: Token,
    _networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance | null> {
    if (wallet.type !== "btc" || token.symbol !== "BTC") return null;

    const balances = await this.fetchWalletBalances(
      wallet,
      [],
      [],
      priceInfo,
    );
    return balances[0] || null;
  }
}
