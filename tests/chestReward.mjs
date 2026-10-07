import assert from "node:assert/strict";
import { chestRewardItemID, chestRewardPreview, newlyGrantedGear } from
  "../src/modules/idle-rpg/game/chestReward.ts";

const opened = { Resources: { Grant: { Standard: { Entries: [
  { Type: "Item", CatalogID: "Item", ItemID: "iron_sword", Amount: 1 },
] } } } };
assert.equal(chestRewardItemID(opened), "iron_sword");
assert.equal(chestRewardItemID({}), null);

const before = new Set(["old-sword"]);
const gear = [
  { instanceID: "old-sword", itemID: "iron_sword" },
  { instanceID: "unrelated", itemID: "traveler_boots" },
  { instanceID: "new-sword", itemID: "iron_sword" },
];
assert.equal(newlyGrantedGear(gear, before, "iron_sword")?.instanceID, "new-sword",
  "a simultaneous unrelated inventory grant cannot replace the rolled item");
assert.equal(newlyGrantedGear(gear.slice(0, 1), before, "iron_sword"), null,
  "the first inventory snapshot may still be stale");
assert.equal(newlyGrantedGear(gear, before, null)?.instanceID, "unrelated",
  "a result without item details can still use a newly observed instance");

const definitions = new Map([["iron_sword", {
  DisplayName: "Iron Sword", Metadata: { RarityID: "Rare" },
  Stats: { FlatBonuses: { Damage: 15 } },
  Equipment: { AllowedSlotIDs: ["Weapon"] },
}]]);
const preview = chestRewardPreview("iron_sword", definitions);
assert.equal(preview?.name, "Iron Sword");
assert.equal(preview?.rarity, "Rare");
assert.equal(preview?.bonuses.attack, 15);
assert.equal(chestRewardPreview("missing", definitions), null);
console.log("Chest result selection, stale inventory and authoritative reward preview passed");
