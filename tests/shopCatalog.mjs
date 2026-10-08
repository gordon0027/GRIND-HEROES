import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { shopCatalog, visibleProducts } from "../src/modules/store/shopCatalog.ts";
import { requestTokenPurchase } from "../src/modules/store/tokenPurchase.ts";

for (const category of ["gems", "chests"]) {
  const products = visibleProducts(category);
  assert.ok(products.length > 0, `${category} category must render`);
  assert.ok(products.every((product) => product.enabled && product.category === category));
  assert.deepEqual(products.map((product) => product.sortOrder),
    products.map((product) => product.sortOrder).sort((a, b) => a - b));
}

for (const product of shopCatalog) {
  assert.ok(product.provisionalTokenPrice > 0);
  assert.ok(existsSync(resolve("public", product.art)), `missing artwork: ${product.art}`);
  assert.deepEqual(requestTokenPurchase(product.id),
    { status: "unavailable", code: "TOKEN_PROVIDER_NOT_IMPLEMENTED" });
}

assert.deepEqual(requestTokenPurchase("nonexistent"),
  { status: "failed", code: "PRODUCT_UNAVAILABLE" });

const disabled = shopCatalog[0];
const previous = disabled.enabled;
disabled.enabled = false;
try {
  assert.ok(!visibleProducts(disabled.category).some((product) => product.id === disabled.id));
  assert.deepEqual(requestTokenPurchase(disabled.id),
    { status: "failed", code: "PRODUCT_UNAVAILABLE" });
} finally {
  disabled.enabled = previous;
}

console.log("Shop catalog and purchase boundary passed");
