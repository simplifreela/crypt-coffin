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

export class NearBalanceProvider implements BalanceProvider {
  private readonly nearRpcUrl = "https://1rpc.io/near";

  supportsWalletType(type: string): boolean {
    return type === "near";
  }

  async fetchWalletBalances(
    wallet: Wallet,
    tokens: Token[],
    _networks: EVMNetwork[],
    priceInfo: TokenPriceInfo,
  ): Promise<Balance[]> {
    const newBalances: Balance[] = [];

    // Fetch native NEAR balance
    try {
      const response = await fetch(this.nearRpcUrl, {
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
      if (!response.ok) {
        throw new Error(`NEAR RPC error: ${response.statusText}`);
      }
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
      let nearPrice = getPrice("NEAR", priceInfo);
      if (!nearPrice || nearPrice === 0) {
        nearPrice = await getPriceWithFallback("NEAR", priceInfo);
      }

      if (nearBalance > 0.00000001) {
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

    // Fetch NEP-141 token balances in parallel
    const nearTokens = tokens.filter(
      (t) => t.networkId === "near" && t.address !== ZERO_ADDRESS,
    );

    const tokenPromises = nearTokens.map(async (token) => {
      try {
        const args_base64 = btoa(JSON.stringify({ account_id: wallet.address }));
        const ftBalancePromise = fetch(this.nearRpcUrl, {
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

        const ftMetadataPromise = fetch(this.nearRpcUrl, {
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

        if (balanceRes.error) {
          throw new Error(balanceRes.error.data || "Failed to fetch balance");
        }
        if (metadataRes.error) {
          throw new Error(metadataRes.error.data || "Failed to fetch metadata");
        }

        const balanceRaw = JSON.parse(
          new TextDecoder().decode(new Uint8Array(balanceRes.result.result)),
        );
        const metadata = JSON.parse(
          new TextDecoder().decode(new Uint8Array(metadataRes.result.result)),
        );
        const decimals = metadata.decimals;

        const balance = formatUnits(balanceRaw, decimals);
        const price = getPrice(token.symbol, priceInfo);

        if (parseFloat(balance) > 0.00000001) {
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
          `Failed to fetch balance for NEAR token ${token.name}`,
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
    if (wallet.type !== "near" || token.networkId !== "near") return null;

    const balances = await this.fetchWalletBalances(
      wallet,
      [token],
      [],
      priceInfo,
    );
    return balances.find((b) => b.tokenId === token.id) || null;
  }
}
