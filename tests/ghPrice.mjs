import assert from "node:assert/strict";
import {
  GH_SOLANA_MINT, formatGhUsd, ghMarketPairUrl, selectGhMarketQuote,
} from "../src/modules/store/ghPrice.ts";

const base = {
  chainId: "solana", baseToken: { address: GH_SOLANA_MINT },
  pairAddress: "2ixSH3sYPwJggkw71LjQcRXVHcD9YufZ7dFy2yMGeTMT",
  priceUsd: "0.000002340", liquidity: { usd: 1000 },
};
assert.equal(selectGhMarketQuote(null), null);
assert.equal(selectGhMarketQuote([{ ...base, baseToken: { address: "other" } }]), null);
assert.equal(selectGhMarketQuote([{ ...base, chainId: "ethereum" }]), null);
assert.equal(selectGhMarketQuote([{ ...base, priceUsd: "0" }]), null);
assert.equal(selectGhMarketQuote([{ ...base, priceUsd: "not a price" }]), null);
assert.equal(selectGhMarketQuote([{ ...base, pairAddress: "../bad" }]), null);
const quote = selectGhMarketQuote([
  { ...base, priceUsd: "0.5", liquidity: { usd: 1 } },
  base,
], 123);
assert.equal(quote?.usdPerGh, 0.00000234, "the deepest valid GH pair wins");
assert.equal(quote?.observedAt, 123);
assert.equal(formatGhUsd(1000, quote), "$0.00234");
assert.equal(formatGhUsd(5, quote), "$0.0000117");
assert.equal(ghMarketPairUrl(quote), `https://dexscreener.com/solana/${base.pairAddress}`);
console.log("GH/USD mint validation, pair selection and approximate formatting passed");
