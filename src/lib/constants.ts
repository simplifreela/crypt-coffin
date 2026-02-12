import type { EVMNetwork } from "@/types";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const DEFAULT_EVM_NETWORKS: EVMNetwork[] = [
  {
    id: "1",
    chainId: 1,
    name: "Ethereum",
    rpcUrl:
      "https://eth-mainnet.g.alchemy.com/v2/dRC43zHg8eyn83eR5GOiO7sfFYW8sl6t",
    isCustom: false,
    symbol: "ETH",
  },
  {
    id: "137",
    chainId: 137,
    name: "Polygon",
    rpcUrl:
      "https://polygon-mainnet.g.alchemy.com/v2/dRC43zHg8eyn83eR5GOiO7sfFYW8sl6t",
    isCustom: false,
    symbol: "POL",
  },
  {
    id: "10",
    chainId: 10,
    name: "Optimism",
    rpcUrl:
      "https://opt-mainnet.g.alchemy.com/v2/dRC43zHg8eyn83eR5GOiO7sfFYW8sl6t",
    isCustom: false,
    symbol: "ETH",
  },
  {
    id: "56",
    chainId: 56,
    name: "BNB Smart Chain",
    rpcUrl:
      "https://bnb-mainnet.g.alchemy.com/v2/dRC43zHg8eyn83eR5GOiO7sfFYW8sl6t",
    isCustom: false,
    symbol: "BNB",
  },
  {
    id: "42161",
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl:
      "https://arb-mainnet.g.alchemy.com/v2/dRC43zHg8eyn83eR5GOiO7sfFYW8sl6t",
    isCustom: false,
    symbol: "ETH",
  },
  {
    id: "8453",
    chainId: 8453,
    name: "Base",
    rpcUrl:
      "https://base-mainnet.g.alchemy.com/v2/dRC43zHg8eyn83eR5GOiO7sfFYW8sl6t",
    isCustom: false,
    symbol: "ETH",
  },
  {
    id: "43114",
    chainId: 43114,
    name: "Avalanche",
    rpcUrl:
      "https://avax-mainnet.g.alchemy.com/v2/dRC43zHg8eyn83eR5GOiO7sfFYW8sl6t",
    isCustom: false,
    symbol: "AVAX",
  },
];
