import assert from "node:assert/strict";
import { checkGhSolanaMint, GH_MINT, SPL_TOKEN_PROGRAM } from "../scripts/check-gh-solana-mint.mjs";

function rpcFixture({ decimals = 6, owner = SPL_TOKEN_PROGRAM } = {}) {
  const methods = [];
  const fetchImpl = async (_url, options) => {
    assert.equal(options.method, "POST");
    const request = JSON.parse(options.body);
    methods.push(request.method);
    assert.equal(request.params[0], GH_MINT);
    assert.equal(request.params[1].commitment, "finalized");
    const result = request.method === "getAccountInfo"
      ? { context: { slot: 100 }, value: { owner, data: { parsed: { type: "mint",
        info: { isInitialized: true, decimals, supply: "1000000000000000",
          mintAuthority: null } } } } }
      : { context: { slot: 101 }, value: { amount: "1000000000000000",
        decimals, uiAmountString: "1000000000" } };
    return { ok: true, json: async () => ({ result }) };
  };
  return { fetchImpl, methods };
}

const good = rpcFixture();
const details = await checkGhSolanaMint(good.fetchImpl);
assert.deepEqual(good.methods, ["getAccountInfo", "getTokenSupply"]);
assert.equal(details.baseUnitsPerGh, "1000000");
assert.equal(details.mintAuthorityPresent, false);

await assert.rejects(() => checkGhSolanaMint(rpcFixture({ decimals: 0 }).fetchImpl),
  /gh_mint_decimals_changed:0/);
await assert.rejects(() => checkGhSolanaMint(rpcFixture({ owner: "wrong-owner" }).fetchImpl),
  /gh_mint_is_not_initialized_legacy_spl_token/);

console.log("Read-only GH mint preflight and decimal mismatch checks passed");
