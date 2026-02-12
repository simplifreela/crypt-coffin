import { normalizeAddress } from "../src/lib/addressUtils";

async function run() {
  console.log("Running addressUtils tests...\n");

  // EVM test (lowercase address should checksum)
  const evmLower = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // USDC mainnet
  const evmRes = await normalizeAddress(evmLower, "evm");
  console.log("EVM input:", evmLower);
  console.log("EVM result:", evmRes);

  // Solana test (example pubkey)
  const solanaKey = "4Nd1m3s3gR1qZ28tqgS3mCq1cX1V5K9jz7x3sBqkz9Aq"; // random-like
  const solRes = await normalizeAddress(solanaKey, "solana");
  console.log("\nSolana input:", solanaKey);
  console.log("Solana result:", solRes);

  // BTC test (bech32 example)
  const btcBech32 = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080";
  const btcRes = await normalizeAddress(btcBech32, "btc");
  console.log("\nBTC input:", btcBech32);
  console.log("BTC result:", btcRes);

  // Invalid address
  const invalid = "not-an-address";
  const invalidRes = await normalizeAddress(invalid, "evm");
  console.log("\nInvalid input:", invalid);
  console.log("Invalid result:", invalidRes);

  console.log("\nTests complete.");
}

run().catch((e) => {
  console.error("Test run failed:", e);
  process.exit(1);
});
