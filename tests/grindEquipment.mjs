import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { combatPower, ownedGear, stageHeroStats, totalBonuses } from "../src/modules/idle-rpg/game/equipment.ts";
import { GrindEquipmentService, attestedGrindAssignments, emptyGrindEquipment, grindAssignments, isGrindEquipped,
  parseGrindEquipment } from "../src/modules/idle-rpg/game/grindEquipment.ts";

const code = readFileSync(new URL("../src/modules/idle-rpg/server/stageRewards.js", import.meta.url), "utf8") + "\n" +
  readFileSync(new URL("../src/modules/idle-rpg/server/grindEquipment.js", import.meta.url), "utf8");
const slots = ["Helmet", "Armor", "Gloves", "Boots", "Weapon", "Offhand"];
const item = (id, slot, rarity, heroes = [], stats = {}) => ({ ItemID: id, IsStackable: false,
  Metadata: { RarityID: rarity }, Equipment: { AllowedSlotIDs: [slot], AllowedCharacterIDs: heroes },
  Stats: { FlatBonuses: stats } });
const definitions = {
  boots_common: item("boots_common", "Boots", "Common", [], { MoveSpeed: 5 }),
  boots_uncommon: item("boots_uncommon", "Boots", "Uncommon", [], { MoveSpeed: 8 }),
  sword_rare: item("sword_rare", "Weapon", "Rare", ["Knight"], { Damage: 15 }),
  sword_epic: item("sword_epic", "Weapon", "Epic", ["Knight"], { Damage: 24 }),
  sword_legendary: item("sword_legendary", "Weapon", "Legendary", ["Knight"], { Damage: 36 }),
  bow_common: item("bow_common", "Weapon", "Common", ["Archer"], { Damage: 5 }),
  shield_common: item("shield_common", "Offhand", "Common", ["Knight"], { Health: 20 }),
};
const instances = {
  bootsA: { ItemID: "boots_common", CatalogID: "Item", EquippedSlot: { CharacterID: "Knight", SlotID: "Boots" } },
  bootsB: { ItemID: "boots_uncommon", CatalogID: "Item", EquippedSlot: null },
  swordA: { ItemID: "sword_rare", CatalogID: "Item", EquippedSlot: null },
  swordB: { ItemID: "sword_rare", CatalogID: "Item", EquippedSlot: null },
  swordEpic: { ItemID: "sword_epic", CatalogID: "Item", EquippedSlot: null },
  swordLegendary: { ItemID: "sword_legendary", CatalogID: "Item", EquippedSlot: null },
  bowA: { ItemID: "bow_common", CatalogID: "Item", EquippedSlot: null },
  shieldA: { ItemID: "shield_common", CatalogID: "Item", EquippedSlot: null },
};
const records = { Private: {}, ReadOnly: {}, Internal: {}, Public: {} };
const player = { InventoryV2: { UnstackableItems: {}, Items: {} },
  Character: { Characters: { Knight: { Level: 1, Equipment: {} },
    Archer: { Level: 1, Equipment: {} }, Mage: { Level: 1, Equipment: {} } } } };
const syncCounts = () => {
  player.InventoryV2.Items = {};
  for (const instance of Object.values(instances)) {
    const count = player.InventoryV2.Items[instance.ItemID] ?? { UnstackableAmount: 0 };
    count.UnstackableAmount++;
    player.InventoryV2.Items[instance.ItemID] = count;
  }
};
syncCounts();
const nativeEquip = (heroID, slot, instanceID) => {
  const instance = instances[instanceID];
  if (!instance) return;
  player.Character.Characters[heroID].Equipment[slot] = {
    ItemInstanceID: instanceID, ItemID: instance.ItemID, CatalogID: instance.CatalogID, Level: 1,
  };
};
nativeEquip("Knight", "Boots", "bootsA");
const config = { Item: { Catalogs: { Item: { Items: definitions } } },
  Character: { Definitions: Object.fromEntries(["Knight", "Archer", "Mage"].map((heroID) =>
    [heroID, { Unlock: { UnlockedByDefault: heroID === "Knight" },
      Equipment: { Slots: Object.fromEntries(slots.map((slot) => [slot, { SlotID: slot }])) } }])) } };
const server = {
  GetUserCustomData: () => ({ Success: true, Data: records }),
  ReadUserData: () => player,
  GetTitleConfig: () => config,
  SetUserCustomData: (bucket, key, value) => {
    records[bucket][key] = { Value: value };
    return { Success: true };
  },
};
const sandbox = { server, handlers: {}, log: { Warning: () => {} }, Date, Math, JSON, Number,
  Object, Array, isFinite, Error };
runInNewContext(code, sandbox);
const load = () => parseGrindEquipment(sandbox.handlers.getGrindEquipment().equipment);
const stateJSON = () => JSON.stringify(load());
const level = (value) => { records.ReadOnly.grind_hero_xp_v1 = { Value: JSON.stringify({ Knight: { level: value, xp: 0 } }) }; };
const equip = (slot, itemInstanceID, heroID = "Knight") => {
  nativeEquip(heroID, slot, itemInstanceID);
  return sandbox.handlers.equipGrindItem({ heroID, slot, itemInstanceID });
};
const unequip = (slot, heroID = "Knight") => sandbox.handlers.unequipGrindItem({ heroID, slot });

level(1);
let state = load();
assert.equal(state.heroes.Knight.Boots, "bootsA", "valid native gear migrates once");
assert.equal(state.heroes.Knight.Weapon, null);
assert.equal(records.ReadOnly.grind_equipment_v1.Value !== undefined, true);
assert.equal(sandbox.handlers.equipGrindItem({ heroID: "Knight", slot: "Offhand",
  itemInstanceID: "shieldA" }).reason, "ITEM_NOT_OWNED",
"CloudCode requires exact native ownership attestation before changing Grind state");
nativeEquip("Knight", "Boots", "bootsB");
assert.equal(load().heroes.Knight.Boots, null,
  "replacing native gear revokes the old Grind assignment before it can be sold");
assert.equal(equip("Boots", "bootsB").reason, "HERO_LEVEL_TOO_LOW");
assert.equal(load().heroes.Knight.Boots, null, "rejected replacement grants no Grind assignment");
assert.equal(equip("Weapon", "bootsA").reason, "INVALID_SLOT");
assert.equal(equip("Weapon", "missing").reason, "ITEM_NOT_OWNED");
assert.equal(equip("Weapon", "bowA").reason, "WRONG_CHARACTER");
assert.equal(equip("Boots", "bootsA").equipped, true, "same instance is idempotent");

for (const [below, threshold, instanceID, slot] of [
  [4, 5, "bootsB", "Boots"], [9, 10, "swordA", "Weapon"],
  [14, 15, "swordEpic", "Weapon"], [19, 20, "swordLegendary", "Weapon"],
]) {
  level(below);
  assert.equal(equip(slot, instanceID).reason, "HERO_LEVEL_TOO_LOW");
  assert.notEqual(load().heroes.Knight[slot], instanceID,
    `Lv${below} never grants the native-attested item a Grind assignment`);
  level(threshold);
  assert.equal(equip(slot, instanceID).equipped, true, `Lv${threshold} accepts tier`);
  assert.equal(load().heroes.Knight[slot], instanceID);
  assert.equal(unequip(slot).unequipped, true);
  assert.equal(load().heroes.Knight[slot], null);
}

level(10);
assert.equal(equip("Weapon", "swordA").equipped, true);
assert.equal(isGrindEquipped(load(), "swordA"), true);
assert.equal(isGrindEquipped(load(), "swordB"), false, "duplicate item IDs stay distinct");
assert.equal(equip("Weapon", "swordB").equipped, true, "replacement writes one record");
assert.equal(isGrindEquipped(load(), "swordA"), false);
assert.equal(isGrindEquipped(load(), "swordB"), true);
assert.equal(sandbox.handlers.isGrindEquipped({ itemInstanceID: "swordB" }).equipped, true);

level(4);
const beforeInvalidBest = stateJSON();
nativeEquip("Knight", "Weapon", "swordA");
assert.equal(sandbox.handlers.equipBestGrindHero({ heroID: "Knight",
  slots: { Weapon: "swordA" } }).reason, "HERO_LEVEL_TOO_LOW");
assert.equal(stateJSON(), beforeInvalidBest, "invalid batch changes no protected slot");
nativeEquip("Knight", "Boots", "bootsA");
nativeEquip("Knight", "Offhand", "shieldA");
assert.equal(sandbox.handlers.equipBestGrindHero({ heroID: "Knight",
  slots: { Boots: "bootsA", Offhand: "shieldA" } }).equipped, true);
state = load();
assert.equal(state.heroes.Knight.Boots, "bootsA", "Equip Best skips Lv5 boots");
assert.equal(state.heroes.Knight.Weapon, null, "Equip Best skips Lv10+ swords");
assert.equal(state.heroes.Knight.Offhand, "shieldA");

const base = { maxHp: 120, damage: 10, armor: 0, attackSpeed: 1,
  critChance: 0, critMultiplier: 1.5, dodge: 0, regen: 0, multiShot: 0 };
const archetype = { moveSpeed: 140, attackRange: 0.13, cadence: 1, hit: 1 };
const defsMap = new Map(Object.entries(definitions));
const beforeNative = load();
const gearBefore = ownedGear(instances, defsMap, grindAssignments(beforeNative));
const powerBefore = combatPower(stageHeroStats(base, archetype, totalBonuses(gearBefore, "Knight")));
nativeEquip("Knight", "Weapon", "swordLegendary");
const afterNative = load();
const gearAfter = ownedGear(instances, defsMap, grindAssignments(afterNative));
const powerAfter = combatPower(stageHeroStats(base, archetype, totalBonuses(gearAfter, "Knight")));
assert.deepEqual(JSON.parse(JSON.stringify(afterNative)), JSON.parse(JSON.stringify(beforeNative)),
  "native bypass never changes Grind state");
assert.equal(powerAfter, powerBefore, "native bypass never raises Grind Power");
assert.equal(gearAfter.find((entry) => entry.instanceID === "swordLegendary").equippedBy, null,
  "native bypass item stays visible in Grind bag");
assert.equal(unequip("Offhand").unequipped, true);
const powerWithoutShield = combatPower(stageHeroStats(base, archetype,
  totalBonuses(ownedGear(instances, defsMap, grindAssignments(load())), "Knight")));
assert.equal(equip("Offhand", "shieldA").equipped, true);
assert.ok(combatPower(stageHeroStats(base, archetype,
  totalBonuses(ownedGear(instances, defsMap, grindAssignments(load())), "Knight"))) > powerWithoutShield,
"valid Grind equip increases Power");
const protectedBeforeNativeUnequip = load();
delete player.Character.Characters.Knight.Equipment.Offhand;
assert.equal(attestedGrindAssignments(protectedBeforeNativeUnequip, player.Character.Characters).shieldA, undefined,
  "a native unequip cannot leave a client-side Grind bonus");
assert.equal(load().heroes.Knight.Offhand, null,
  "direct native unequip revokes protected Grind gear before the next stage signature");

delete instances.shieldA;
syncCounts();
assert.equal(load().heroes.Knight.Offhand, null, "missing instance is cleaned safely");
assert.equal(sandbox.handlers.isGrindEquipped({ itemInstanceID: "shieldA" }).equipped, false);
assert.deepEqual(parseGrindEquipment(emptyGrindEquipment()), emptyGrindEquipment());
const calls = [];
const client = { data: { user: { state: { Character: { Characters: {
  Knight: { Equipment: { Helmet: { ItemInstanceID: "helmOwned" } } },
} } } } },
  character: { equipItems: async (_heroID, pairs) => {
    calls.push({ type: "native", pairs });
    return { ok: true, data: { Equipment: { Boots: { ItemInstanceID: "bootsSplit" } } } };
  }, unequipItems: async (_heroID, slots) => {
    calls.push({ type: "native-unequip", slots });
    return { ok: true, data: {} };
  } },
  cloudCode: { execute: async (handler, args) => {
    calls.push({ type: "cloud", handler, args });
    return { ok: true, data: { FunctionResult: { equipped: true, unequipped: true,
      unequippedInstanceID: "helmOwned", equipment: emptyGrindEquipment() } } };
  } },
};
const service = new GrindEquipmentService(client);
await service.equip("Knight", "Helmet", "helmOwned");
assert.deepEqual(calls.map((call) => call.type), ["cloud"],
  "already-native-equipped instance is attested without another native write");
calls.length = 0;
await service.equipBest("Knight", { Helmet: "helmOwned", Boots: "bootsOriginal" });
assert.equal(calls[0].pairs.length, 1, "Equip Best skips already-attested slots");
assert.equal(calls[0].pairs[0].SlotID, "Boots");
assert.equal(calls[1].args.slots.Helmet, "helmOwned");
assert.equal(calls[1].args.slots.Boots, "bootsSplit",
  "server receives the native-confirmed ID if iDos split an instance");
calls.length = 0;
await service.unequip("Knight", "Helmet");
assert.deepEqual(calls.map((entry) => entry.type), ["cloud", "native-unequip"],
  "Grind unequip releases the native Marketplace listing guard");
assert.deepEqual(calls[1].slots, ["Helmet"]);
console.log("Grind equipment migration, authority, boundaries, class, ownership, slots, replace, best, bypass and stale cleanup passed");
