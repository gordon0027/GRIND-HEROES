import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { shopCatalog, visibleProducts } from "../src/modules/store/shopCatalog.ts";
import {
  classifyTokenPurchaseError, createTokenPurchaseGate, formatWholeGh,
  isTokenShopProductID, purchaseTokenShopProduct, resolveTokenShopOffer,
  showDepositOnPurchaseError, tokenPurchaseMessage, tokenStoreOffers,
} from "../src/modules/store/tokenPurchase.ts";

for (const category of ["gems", "chests"]) {
  const products = visibleProducts(category);
  assert.ok(products.length > 0, `${category} category must render`);
  assert.ok(products.every((product) => product.enabled && product.category === category));
  assert.deepEqual(products.map((product) => product.sortOrder),
    products.map((product) => product.sortOrder).sort((a, b) => a - b));
}
for (const product of shopCatalog) {
  assert.ok(existsSync(resolve("public", product.art)), `missing artwork: ${product.art}`);
  assert.equal(isTokenShopProductID(product.id), product.enabled);
  assert.equal(Object.hasOwn(tokenStoreOffers, product.id), product.enabled);
  assert.ok(!Object.hasOwn(product, "tokenPrice"), "presentation catalog must not set the charged price");
}
assert.deepEqual(visibleProducts("chests").map((product) => product.id), ["premium_chest_v1"]);

const terms = {
  gems_small: [5, 500, "VirtualCurrency", "GEMS"],
  gems_medium: [12, 1200, "VirtualCurrency", "GEMS"],
  gems_large: [30, 3000, "VirtualCurrency", "GEMS"],
  premium_chest_v1: [20, 1, "Item", "premium_chest_v1"],
};
function makeFront(productID, priceOverride) {
  const address = tokenStoreOffers[productID];
  const [price, amount, type, id] = terms[productID];
  return { ServerTimeUtc: "2026-10-08T00:00:00Z", Stores: [{ StoreID: "shop", Sections: [{
    SectionID: address.sectionID, Slots: [{ SlotID: address.slotID, Offer: {
      OfferID: address.offerID,
      PriceOptions: [{ OptionID: "gh", IsFree: false, IsStorePaid: false, IsAdPaid: false,
        Cost: { Standard: { Entries: [{ Type: "CryptoCurrency", CurrencyID: "Main", Amount: priceOverride ?? price }] } } }],
      Rewards: { Standard: { Entries: [type === "Item"
        ? { Type: type, CatalogID: "Item", ItemID: id, Amount: amount }
        : { Type: type, CurrencyID: id, Amount: amount }] } },
      State: { SoldOut: false },
    } }],
  }] }] };
}

for (const productID of Object.keys(terms)) {
  const offer = resolveTokenShopOffer(makeFront(productID), productID);
  assert.ok(offer, `${productID} resolves to a native Store slot`);
  assert.equal(offer.offerID, tokenStoreOffers[productID].offerID);
  assert.equal(offer.ghPrice, terms[productID][0]);
  assert.equal(offer.rewardAmount, terms[productID][1]);
}
assert.equal(resolveTokenShopOffer(makeFront("gems_small", 7), "gems_small").ghPrice, 7,
  "runtime price must come from Storefront");
assert.equal(resolveTokenShopOffer(makeFront("gems_small"), "chest_rare"), null);
const malformed = makeFront("gems_small");
malformed.Stores[0].Sections[0].Slots[0].Offer.PriceOptions[0].Cost.Standard.Entries[0].CurrencyID = "GEMS";
assert.equal(resolveTokenShopOffer(malformed, "gems_small"), null);
assert.equal(formatWholeGh("125.000"), "125");
assert.equal(formatWholeGh("12000"), "12,000");
assert.equal(formatWholeGh("12.5"), "—");

function makeClient(purchaseImpl) {
  const calls = [];
  const client = {
    store: {
      purchase: async (...args) => { calls.push(["purchase", ...args]); return purchaseImpl(); },
      getStorefront: async () => { calls.push(["storefront"]); return { ok: true, data: {} }; },
    },
    user: { getUserInventory: async () => { calls.push(["inventory"]); return { ok: true, data: {} }; } },
  };
  return { client, calls };
}
for (const productID of ["gems_small", "premium_chest_v1"]) {
  const { client, calls } = makeClient(() => ({ ok: true, data: {} }));
  const result = await purchaseTokenShopProduct(client, productID, resolveTokenShopOffer(makeFront(productID), productID));
  assert.deepEqual(result, { ok: true, inventoryFresh: true, storefrontFresh: true });
  assert.deepEqual(calls[0], ["purchase", tokenStoreOffers[productID].offerID, 1, {
    selectedOptionID: "gh", slot: { storeID: "shop", sectionID: tokenStoreOffers[productID].sectionID,
      slotID: tokenStoreOffers[productID].slotID },
  }]);
  assert.ok(calls.some(([name]) => name === "inventory"), `${productID} refreshes authoritative inventory`);
  assert.ok(calls.some(([name]) => name === "storefront"), `${productID} refreshes Store counters`);
}

const disabled = makeClient(() => { throw new Error("must not purchase"); });
assert.deepEqual(await purchaseTokenShopProduct(disabled.client, "chest_rare", null), { ok: false, error: "disabled" });
assert.deepEqual(disabled.calls, []);

const rejected = makeClient(() => ({ ok: false, reason: "server", error: "Not enough balance: have 0 Main, need 5." }));
assert.deepEqual(await purchaseTokenShopProduct(rejected.client, "gems_small",
  resolveTokenShopOffer(makeFront("gems_small"), "gems_small")),
{ ok: false, error: "insufficient", detail: "Not enough balance: have 0 Main, need 5." });
assert.deepEqual(rejected.calls.map(([name]) => name), ["purchase"], "failed purchase never applies a local grant");
assert.equal(classifyTokenPurchaseError("server", "OFFER_NOT_IN_ROTATION"), "unavailable");
assert.equal(classifyTokenPurchaseError("server", "Daily purchase limit reached"), "limit");
assert.equal(classifyTokenPurchaseError("connection", undefined), "connection");
assert.match(tokenPurchaseMessage("insufficient"), /Not enough GH/);
assert.equal(showDepositOnPurchaseError("insufficient"), true);
assert.equal(showDepositOnPurchaseError("server"), false);

let finish;
const pending = new Promise((resolvePending) => { finish = resolvePending; });
const doubled = makeClient(async () => { await pending; return { ok: true, data: {} }; });
const gate = createTokenPurchaseGate();
const offer = resolveTokenShopOffer(makeFront("gems_small"), "gems_small");
const first = gate.run(() => purchaseTokenShopProduct(doubled.client, "gems_small", offer));
const second = gate.run(() => purchaseTokenShopProduct(doubled.client, "gems_small", offer));
assert.equal(await second, null);
assert.equal(doubled.calls.filter(([name]) => name === "purchase").length, 1);
finish();
assert.equal((await first).ok, true);

console.log("Native GH Shop offer mapping, price, refresh, errors and double-click gate passed");
