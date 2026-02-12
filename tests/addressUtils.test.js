async function run() {
  console.log('Running plain JS address utils test...\n');

  // EVM test
  const evmLower = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  try {
    const { utils } = require('ethers');
    const checksummed = utils.getAddress(evmLower);
    console.log('EVM input:', evmLower);
    console.log('EVM checksummed:', checksummed);
  } catch (e) {
    console.warn('EVM check skipped or failed:', e.message || e);
  }

  // Solana test
  const solanaKey = '4Nd1m3s3gR1qZ28tqgS3mCq1cX1V5K9jz7x3sBqkz9Aq';
  try {
    const { PublicKey } = require('@solana/web3.js');
    const pub = new PublicKey(solanaKey);
    console.log('\nSolana input:', solanaKey);
    console.log('Solana normalized:', pub.toString());
  } catch (e) {
    console.warn('\nSolana check skipped or failed:', e.message || e);
  }

  // BTC test (bech32)
  const btcBech32 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080';
  try {
    const bs58check = require('bs58check');
    try {
      bs58check.decode(btcBech32);
      console.log('\nBTC input:', btcBech32);
      console.log('BTC base58check decoded successfully');
    } catch (e) {
      // try bech32
      const bech32 = require('bech32');
      try {
        const decoded = bech32.bech32.decode(btcBech32);
        console.log('\nBTC input:', btcBech32);
        console.log('BTC bech32 decoded, prefix:', decoded.prefix);
      } catch (e2) {
        console.warn('\nBTC check failed:', (e2 && e2.message) || e2);
      }
    }
  } catch (e) {
    // bs58check not installed; try bech32
    try {
      const bech32 = require('bech32');
      const decoded = bech32.bech32.decode(btcBech32);
      console.log('\nBTC input:', btcBech32);
      console.log('BTC bech32 decoded, prefix:', decoded.prefix);
    } catch (e2) {
      console.warn('\nBTC check skipped or failed:', (e2 && e2.message) || e2);
    }
  }

  // Invalid input
  const invalid = 'not-an-address';
  try {
    const { utils } = require('ethers');
    try {
      const r = utils.getAddress(invalid);
      console.log('\nInvalid input unexpectedly checksummed:', r);
    } catch (e) {
      console.log('\nInvalid input correctly failed EVM checksum:', e.message || e);
    }
  } catch (e) {
    console.warn('\nEthers not available to validate invalid input');
  }

  console.log('\nPlain JS tests complete.');
}

run().catch((e) => { console.error('Test run failed:', e); process.exit(1); });
