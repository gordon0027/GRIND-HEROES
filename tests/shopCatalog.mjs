import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { shopCatalog, visibleProducts } from "../src/modules/store/shopCatalog.ts";
import { createTokenPurchaseOrder, formatTokenBaseUnits, getTokenShopCatalog,
  getTokenPurchaseOrder } from "../src/modules/store/tokenPurchase.ts";

for (const category of ["gems", "chests"]) {
  const products = visibleProducts(category);
  assert.ok(products.length > 0, `${category} category must render`);
  assert.ok(products.every((product) => product.enabled && product.category === category));
  assert.deepEqual(products.map((product) => product.sortOrder),
    products.map((product) => product.sortOrder).sort((a, b) => a - b));
}
for (const product of shopCatalog) {
  assert.ok(existsSync(resolve("public", product.art)), `missing artwork: ${product.art}`);
  assert.ok(!Object.hasOwn(product, "provisionalTokenPrice"));
  assert.ok(!Object.hasOwn(product, "amount"));
  assert.ok(!Object.hasOwn(product, "fulfillmentLootboxID"));
}
assert.deepEqual(visibleProducts("chests").map((product) => product.id), ["premium_chest_v1"]);
assert.equal(formatTokenBaseUnits("12000000", 6), "12");
assert.equal(formatTokenBaseUnits("25", 2), "0.25");
assert.equal(formatTokenBaseUnits("20", 0), "20");

const key = "c68163ed-3fb1-442b-b619-28bd7e23b250";
const quote = { productId: "gems_small", productType: "GEMS", tokenCurrencyId: "Main",
  tokenNetwork: "solana", tokenMint: "example-mint", tokenDecimals: 0,
  tokenAmountBaseUnits: "5", rewardType: "GEMS", rewardReference: "GEMS",
  rewardAmount: 500, lootboxId: null };
const order = { ...quote, orderId: `ghord_${key.replaceAll("-", "")}`, status: "CREATED",
  createdAt: "2026-10-08T00:00:00.000Z", expiresAt: "2026-10-08T00:20:00.000Z" };
const calls = [];
const client = { cloudCode: { execute: async (name, args) => {
  calls.push([name, args]);
  return { ok: true, data: { FunctionResult: name === "getTokenShopCatalog"
    ? { products: [quote] } : name === "createTokenPurchaseOrder"
      ? { created: true, order } : { found: true, order } } };
} } };
assert.deepEqual(await getTokenShopCatalog(client), [quote]);
assert.deepEqual(await createTokenPurchaseOrder(client, "gems_small", key), order);
assert.deepEqual(await getTokenPurchaseOrder(client, order.orderId), order);
assert.deepEqual(calls, [
  ["getTokenShopCatalog", {}],
  ["createTokenPurchaseOrder", { productId: "gems_small", idempotencyKey: key }],
  ["getTokenPurchaseOrder", { orderId: order.orderId }],
]);
console.log("Shop presentation and server order request boundary passed");
