// Opt-in, read-only PROD probe. Never purchases, deposits, withdraws or grants.
import assert from "node:assert/strict";
import { createIDosGamesClient } from "@idosgames/core";
import { shopCatalog } from "../src/modules/store/shopCatalog.ts";
import { resolveTokenShopOffer } from "../src/modules/store/tokenPurchase.ts";

if (!process.argv.includes("--run")) {
  console.error("Pass --run to inspect the PROD Storefront without buying.");
  process.exit(2);
}

const client = createIDosGamesClient({ titleID: "98JRCAKG", throttleMs: 0 });
const login = await client.auth.loginWithDeviceID();
if (!login.ok) throw new Error(`login: ${login.error ?? login.reason}`);
const response = await client.store.getStorefront();
if (!response.ok) throw new Error(`storefront: ${response.error ?? response.reason}`);
const offers = [];
for (const product of shopCatalog.filter((item) => item.enabled)) {
  const offer = resolveTokenShopOffer(response.data, product.id);
  assert.ok(offer, `${product.id} is missing from the PROD Storefront`);
  offers.push({ productID: product.id, offerID: offer.offerID, sectionID: offer.sectionID,
    slotID: offer.slotID, ghPrice: offer.ghPrice, rewardAmount: offer.rewardAmount });
}
console.log(JSON.stringify(offers));
process.exit(0);
