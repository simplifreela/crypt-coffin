# **App Name**: Crypto Watcher

## Core Features:

- Wallet Connection: Connect to multiple EVM and non-EVM wallets (Metamask, Near, Solana, BTC).
- EVM Network and Token Discovery: Automatically detect common tokens (ETH, USDC, USDT, wBTC, cbBTC, BTCB) and networks (Ethereum, Polygon, Optimism, BSC, Arbitrum, Base) when a wallet is connected. Implement a function that gets the token list from the connected wallet
- Custom Network Addition: Allow users to add custom EVM networks by providing the RPC URL, chain ID, and network name (optionally fetchable from chainlist.org).
- Manual Token Addition: Enable users to manually add tokens (EVM and non-EVM) by providing the token address and name, and the target network.
- Token Balance Tracking: Track balances of network tokens and added tokens across different wallets and networks.
- Data Persistence: Use IndexedDB for storing wallets, networks, and token data for persistence.
- Wallet Watching: Allow the user to add wallets to watch. These wallets will have the same tokens tracked. These wallets can belong to: Bitcoin, Solana, Near, or Evm. For networks that are not EVM we'll only track the network token.

## Style Guidelines:

- Primary color: Dark slate blue (#2A4BA0) for a trustworthy and secure feel, reflecting the seriousness of financial data.
- Background color: Very dark blue-gray (#121826), a desaturated version of the primary, providing a comfortable contrast and modern aesthetic.
- Accent color: Electric purple (#BE3455), placed to highlight important actions or data points for user emphasis.
- Body and headline font: 'Inter', a grotesque-style sans-serif known for its modern and neutral appearance, suitable for both headlines and body text.
- Use consistent and minimalist icons to represent different cryptocurrencies and networks.
- Design a clean and intuitive layout that displays wallet balances, token information, and network details clearly and efficiently. Prioritize key data to improve user comprehension.
- Implement subtle transitions and animations to enhance user interaction and provide feedback, such as loading animations for data fetching.