import assert from "node:assert/strict";
import {
  createPremiumOpenGate, hasPremiumOption, premiumChestCount, premiumRewardInInventory,
  waitForPremiumReward,
  PREMIUM_CHEST_ITEM_ID, PREMIUM_LOOTBOX_ID, PREMIUM_OPTION_ID,
} from "../src/modules/idle-rpg/game/premiumChest.ts";
import { chestRewardItemID } from "../src/modules/idle-rpg/game/chestReward.ts";

assert.equal(premiumChestCount({ Items: { [PREMIUM_CHEST_ITEM_ID]: { StackableAmount: 3 } } }), 3);
assert.equal(premiumChestCount({ Items: { [PREMIUM_CHEST_ITEM_ID]: { StackableAmount: 0 } } }), 0);
assert.equal(premiumChestCount(undefined), 0);
assert.equal(hasPremiumOption({ Definitions: { [PREMIUM_LOOTBOX_ID]: { PriceOptions: {
  [PREMIUM_OPTION_ID]: { Cost: { Standard: { Entries: [
    { Type: "Item", CatalogID: "Item", ItemID: PREMIUM_CHEST_ITEM_ID, Amount: 1 },
  ] } } },
} } } }), true);
assert.equal(hasPremiumOption({ Definitions: { [PREMIUM_LOOTBOX_ID]: { PriceOptions: {
  [PREMIUM_OPTION_ID]: { Cost: { Standard: { Entries: [
    { Type: "Item", CatalogID: "Item", ItemID: PREMIUM_CHEST_ITEM_ID, Amount: 2 },
  ] } } },
} } } }), false, "an unexpectedly expensive option must not be exposed");

const gate = createPremiumOpenGate();
let calls = 0;
let finish;
const pending = gate.run(async () => { calls++; await new Promise((resolve) => { finish = resolve; }); return "opened"; });
assert.equal(gate.isPending(), true);
assert.equal(await gate.run(async () => { calls++; return "second"; }), undefined);
assert.equal(calls, 1, "two immediate clicks execute only one server call");
finish();
assert.equal(await pending, "opened");
assert.equal(gate.isPending(), false);
await assert.rejects(gate.run(async () => { throw new Error("server rejected"); }), /server rejected/);
assert.equal(gate.isPending(), false, "a rejected open releases the guard");

const response = { Resources: { Grant: { Standard: { Entries: [
  { Type: "Item", CatalogID: "Item", ItemID: "iron_sword", Amount: 1 },
] } } } };
const actualID = chestRewardItemID(response);
assert.equal(actualID, "iron_sword", "the reward comes from the server operation");
const before = new Set(["owned-before"]);
assert.equal(premiumRewardInInventory([{ instanceID: "owned-before", itemID: "iron_sword" }], before, actualID), null);
assert.equal(premiumRewardInInventory([
  { instanceID: "owned-before", itemID: "iron_sword" },
  { instanceID: "unrelated", itemID: "traveler_boots" },
  { instanceID: "reward", itemID: "iron_sword" },
], before, actualID)?.instanceID, "reward", "the reveal uses the new matching instance");

let reads = 0;
let snapshot = { items: [{ instanceID: "owned-before", itemID: "iron_sword" }], count: 3 };
const resolved = await waitForPremiumReward({
  read: async () => {
    reads++;
    if (reads === 2) snapshot = { items: [
      { instanceID: "owned-before", itemID: "iron_sword" },
      { instanceID: "reward", itemID: "iron_sword" },
    ], count: 2 };
    return true;
  },
  items: () => snapshot.items, count: () => snapshot.count,
  previousIDs: before, previousCount: 3, rewardItemID: actualID,
  delay: async () => {},
});
assert.equal(reads, 2, "a stale first inventory read is retried");
assert.equal(resolved?.instanceID, "reward", "only the refreshed authoritative instance is revealed");
assert.equal(await waitForPremiumReward({
  read: async () => false, items: () => snapshot.items, count: () => snapshot.count,
  previousIDs: before, previousCount: 3, rewardItemID: actualID,
  attempts: 2, delay: async () => {},
}), null, "a failed refresh never fabricates a reward");

console.log("Premium chest ownership, option, single-open guard and authoritative reward selection passed");
