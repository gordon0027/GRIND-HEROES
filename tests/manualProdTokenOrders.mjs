// Opt-in PROD probe. Creates exactly two unpaid orders on a fresh guest; never pays or grants.
import assert from "node:assert/strict";
import { createIDosGamesClient } from "@idosgames/core";
import { createTokenPurchaseOrder, getTokenPurchaseOrder, getTokenShopCatalog } from
  "../src/modules/store/tokenPurchase.ts";

if (!process.argv.includes("--run")) {
  console.error("Pass --run for the controlled PROD order-only probe.");
  process.exit(2);
}

const client = createIDosGamesClient({ titleID: "98JRCAKG", throttleMs: 0 });
const must = (name, result) => {
  if (!result.ok) throw new Error(`${name}: ${result.error ?? result.reason}`);
  return result.data;
};
const inventory = async () => must("inventory", await client.user.getUserInventory());
const economyView = (value) => ({
  currencies: value.VirtualCurrencies ?? {},
  crypto: value.CryptoCurrencies ?? {},
  items: value.Items ?? {},
  unstackable: value.UnstackableItems ?? {},
});

must("login", await client.auth.loginWithDeviceID());
const before = economyView(await inventory());
const catalog = await getTokenShopCatalog(client);
assert.equal(catalog.length, 4);
const gems = await createTokenPurchaseOrder(client, "gems_small", crypto.randomUUID());
const chest = await createTokenPurchaseOrder(client, "premium_chest_v1", crypto.randomUUID());
assert.equal(gems.status, "CREATED");
assert.equal(gems.tokenAmountBaseUnits, "5");
assert.equal(gems.rewardReference, "GEMS");
assert.equal(gems.rewardAmount, 500);
assert.equal(chest.status, "CREATED");
assert.equal(chest.tokenAmountBaseUnits, "20");
assert.equal(chest.rewardReference, "premium_chest_v1");
assert.equal(chest.lootboxId, "premium_equipment_v1");
assert.deepEqual(await getTokenPurchaseOrder(client, gems.orderId), gems);
assert.deepEqual(await getTokenPurchaseOrder(client, chest.orderId), chest);
assert.deepEqual(economyView(await inventory()), before);
console.log(JSON.stringify({
  gemOrderId: gems.orderId, chestOrderId: chest.orderId,
  amounts: [gems.tokenAmountBaseUnits, chest.tokenAmountBaseUnits],
  unchangedEconomy: true,
}));
