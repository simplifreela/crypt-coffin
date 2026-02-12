import { Token, EVMNetwork } from "@/types";
import contractAddresses from "@/shared/contract-addresses.json";
import { DEFAULT_EVM_NETWORKS, ZERO_ADDRESS } from "@/lib/constants";

export interface TokenPriceInfo {
  prices: Map<string, number>;
  symbolToTickerMap: Map<string, string>;
}

export const fetchTokenPrices = async (): Promise<TokenPriceInfo> => {
  const prices = new Map<string, number>();
  try {
    const response = await fetch("/api/tokens");
    const cmcData = await response.json();
    if (cmcData && !cmcData.error) {
      cmcData.forEach((t: any) => {
        if (t.symbol) {
          prices.set(t.symbol.toUpperCase(), t.price);
        }
      });
    }
  } catch (e) {
    console.error("Could not fetch token prices.", e);
  }

  return { prices, symbolToTickerMap: new Map() };
};

export const buildMasterTokenList = (
  customNetworks: EVMNetwork[],
  customTokens: Token[],
): { tokens: Token[]; symbolToTickerMap: Map<string, string> } => {
  const allNetworks = [...DEFAULT_EVM_NETWORKS, ...(customNetworks || [])];
  const platformNameToNetworkId: { [key: string]: string } = {
    ethereum: "1",
    polygon: "137",
    optimism: "10",
    "bnb smart chain (bep20)": "56",
    "bnb smart chain": "56",
    arbitrum: "42161",
    "arbitrum one": "42161",
    base: "8453",
    "avalanche c-chain": "43114",
    avalanche: "43114",
  };

  const masterTokenList: Token[] = [];
  const symbolToTickerMap = new Map<string, string>();

  // Native tokens for non-EVM chains (use ZERO_ADDRESS placeholder)
  masterTokenList.push(
    {
      id: `solana-${ZERO_ADDRESS}`,
      address: ZERO_ADDRESS,
      name: "Solana",
      symbol: "SOL",
      networkId: "solana",
      isCustom: false,
    },
    {
      id: `near-${ZERO_ADDRESS}`,
      address: ZERO_ADDRESS,
      name: "Near",
      symbol: "NEAR",
      networkId: "near",
      isCustom: false,
    },
    {
      id: `btc-${ZERO_ADDRESS}`,
      address: ZERO_ADDRESS,
      name: "Bitcoin",
      symbol: "BTC",
      networkId: "btc",
      isCustom: false,
    },
  );

  // Native tokens for all EVM chains
  allNetworks.forEach((net) => {
    masterTokenList.push({
      id: `${net.id}-${ZERO_ADDRESS}`,
      address: ZERO_ADDRESS,
      name: net.name,
      symbol: net.symbol,
      networkId: net.id,
      isCustom: false,
    });
  });

  // Process curated tokens from JSON
  for (const symbolKey in contractAddresses) {
    const tokenData = (contractAddresses as any)[symbolKey];
    const ticker = tokenData.ticker;
    const contracts = tokenData.contracts;

    symbolToTickerMap.set(symbolKey.toUpperCase(), ticker.toUpperCase());

    contracts.forEach((tokenInfo: any) => {
      const platformName = tokenInfo.platform?.name?.toLowerCase();
      const networkId = platformName
        ? platformNameToNetworkId[platformName]
        : undefined;
      const address = tokenInfo.contract_address;

      if (networkId && address) {
        const processedAddress =
          networkId === "solana" || networkId === "near"
            ? address
            : address.toLowerCase();

        masterTokenList.push({
          id: `${networkId}-${processedAddress}`,
          address: processedAddress,
          name: symbolKey,
          symbol: symbolKey,
          networkId: networkId,
          isCustom: false,
        });
      }
    });
  }

  // Add user's custom tokens
  masterTokenList.push(...(customTokens || []));

  // Deduplicate
  const uniqueTokens = [
    ...new Map(masterTokenList.map((item) => [item.id, item])).values(),
  ];
  return { tokens: uniqueTokens, symbolToTickerMap };
};
