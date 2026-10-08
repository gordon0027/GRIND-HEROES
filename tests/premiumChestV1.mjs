import assert from "node:assert/strict";
import { gearRows, rarities, rarityTables } from "./itemBalanceV1.mjs";

// Expectations for the PROD Title Lootbox readback. The Title, not this test, owns live odds.
const topThree = rarities.slice(-3);
assert.deepEqual(topThree, ["Rare", "Epic", "Legendary"]);
const perItemWeight = { Rare: 750, Epic: 220, Legendary: 30 };
const premiumPool = topThree.flatMap((rarity) => {
  const items = gearRows.filter((row) => row.rarity === rarity);
  assert.equal(items.length, 10, `${rarity} equipment family count`);
  return items.map((row) => ({ itemID: row.id, rarity, slot: row.slot,
    weight: perItemWeight[rarity] }));
});

assert.equal(premiumPool.length, 30);
assert.equal(premiumPool.reduce((total, row) => total + row.weight, 0), 10_000);
assert.deepEqual(Object.fromEntries(topThree.map((rarity) => [rarity,
  premiumPool.filter((row) => row.rarity === rarity).reduce((sum, row) => sum + row.weight, 0)])),
  { Rare: 7500, Epic: 2200, Legendary: 300 });
assert.ok(premiumPool.every((row) => topThree.includes(row.rarity)));
assert.ok(perItemWeight.Legendary < perItemWeight.Epic && perItemWeight.Epic < perItemWeight.Rare);
assert.ok(premiumPool.every((row) => ["Helmet", "Armor", "Gloves", "Boots", "Weapon", "Offhand"].includes(row.slot)));

const rarityAt = (ticket) => ticket < 7500 ? "Rare" : ticket < 9700 ? "Epic" : "Legendary";
assert.equal(rarityAt(0), "Rare");
assert.equal(rarityAt(7499), "Rare");
assert.equal(rarityAt(7500), "Epic");
assert.equal(rarityAt(9699), "Epic");
assert.equal(rarityAt(9700), "Legendary");
assert.equal(rarityAt(9999), "Legendary");

// A seeded distribution check is diagnostic; correctness rests on exact weights above.
let seed = 0x6a09e667;
const observed = { Rare: 0, Epic: 0, Legendary: 0 };
for (let i = 0; i < 100_000; i++) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  observed[rarityAt((seed >>> 0) % 10_000)]++;
}
assert.deepEqual(Object.keys(rarityTables), ["act1_stage", "act1_boss", "act2_stage", "act2_boss", "act3_stage", "act3_boss"]);
console.log("Premium Chest structure and deterministic boundaries passed", observed);
