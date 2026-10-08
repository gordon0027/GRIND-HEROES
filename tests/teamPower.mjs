import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fighterStats } from "../src/modules/idle-rpg/game/heroStats.ts";
import { combatPower, stageHeroStats, gearBonuses } from "../src/modules/idle-rpg/game/equipment.ts";
import { heroArchetype } from "../src/modules/idle-rpg/game/heroArchetypes.ts";

const base = new URL("../src/modules/idle-rpg/", import.meta.url);
const source = readFileSync(new URL("game/powerFormula.js", base), "utf8").replace("export function", "function") + "\n" +
  readFileSync(new URL("server/stageRewards.js", base), "utf8") + "\n" +
  readFileSync(new URL("server/grindEquipment.js", base), "utf8") + "\n" +
  readFileSync(new URL("server/teamPower.js", base), "utf8") + "\n" +
  readFileSync(new URL("server/powerRewardPlan.js", base), "utf8") + "\n" +
  readFileSync(new URL("server/powerRewards.js", base), "utf8");

const stat = (id, value, step) => ({ StatID: id, BaseStatValue: value,
  ValueCurve: { Shape: "PerStep", PerStep: step } });
const definitions = Object.fromEntries([
  ["Knight", 10, 120, 1], ["Archer", 9, 90, 1.4], ["Mage", 22, 80, 0.8],
].map(([id, damage, health, speed]) => [id, { CharacterID: id,
  Unlock: { UnlockedByDefault: id === "Knight" },
  Stats: { Damage: stat("Damage", damage, 2), Health: stat("Health", health, 24),
    AttackSpeed: stat("AttackSpeed", speed, 0.01) },
  RankStatCurve: { Shape: "PerStepRate", PerStepRate: 0.25 },
  Equipment: { Slots: { Weapon: {} } },
}]));
const item = { ItemID: "sword", CatalogID: "Item", IsStackable: false,
  Metadata: { RarityID: "Common" },
  Stats: { FlatBonuses: { Damage: 5 } },
  Equipment: { AllowedSlotIDs: ["Weapon"], AllowedCharacterIDs: ["Knight"] },
  Upgrade: { FlatBonusCurve: { Shape: "PerStepRate", PerStepRate: 0.06 } } };
const config = { Character: { Definitions: definitions }, Item: { Catalogs: { Item: { Items: { sword: item } } } } };
const records = { Private: { grind_formation_v2: { Value: JSON.stringify({ version: 2,
  slots: ["Knight", null, null] }) } }, ReadOnly: {
  grind_party_capacity_v2: { Value: "3" },
  grind_equipment_v1: { Value: "" },
} };
const models = { Knight: { Level: 2, StatLevels: { Damage: 3 }, Equipment: {} },
  Archer: { Level: 1, Equipment: {} }, Mage: { Level: 1, Equipment: {} } };
const equipment = { version: 1, heroes: {
  Knight: { Weapon: null }, Archer: { Weapon: null }, Mage: { Weapon: null },
}, items: {} };
for (const hero of Object.keys(equipment.heroes))
  for (const slot of ["Helmet", "Armor", "Gloves", "Boots", "Offhand"])
    equipment.heroes[hero][slot] = null;
records.ReadOnly.grind_equipment_v1.Value = JSON.stringify(equipment);
const title = { value: null, version: 0 };
let conflict = false;
const server = {
  GetUserCustomData: () => ({ Success: true, Data: records }),
  SetUserCustomData: (bucket, key, value) => {
    records[bucket][key] = { Value: value };
    return { Success: true };
  },
  ReadUserData: (parts) => parts.length === 1 && parts[0] === "PublicData"
    ? { PublicData: { Username: "Tester" } }
    : { Character: { Characters: models }, InventoryV2: { Items: {
      sword: { UnstackableAmount: 1 },
    } } },
  GetTitleConfig: () => ({ Success: true, Data: config }),
  GetTitleCustomData: () => ({ Success: true, Data: { Runtime: { Private: title.value
    ? { grind_team_power_top_v1: { Value: title.value, Version: title.version } } : {} } } }),
  SetTitleCustomData: (_bucket, _key, value, version) => {
    if (conflict) {
      conflict = false;
      title.value = JSON.stringify({ version: 1, entries: [{ playerId: "rival", displayName: "Rival",
        power: 777, scoreAt: "2026-01-01T00:00:00Z" }] });
      title.version++;
    }
    if (version !== title.version) return { Success: false, Error: "version_conflict" };
    title.value = value;
    title.version++;
    return { Success: true };
  },
};
const context = vm.createContext({ server, handlers: {}, log: { Warning() {} } });
vm.runInContext(source, context);
const call = (args = {}) => context.handlers.getTeamPowerLeaderboard(args, { UserID: "player-1" });
const expectedPower = (id) => {
  const def = definitions[id];
  const model = { ...models[id], Equipment: {} };
  const baseStats = fighterStats({ section: config.Character, def, model, items: new Map() });
  const gear = id === "Knight" && equipment.heroes.Knight.Weapon
    ? gearBonuses(item, 2) : { attack: 0, maxHp: 0, defence: 0, attackSpeed: 0, moveSpeed: 0 };
  return combatPower(stageHeroStats(baseStats, heroArchetype(id), gear));
};
let result = call({ power: 999999999, score: 999999999, equipment: { Damage: 999999999 } });
assert.equal(result.power, expectedPower("Knight"), "one hero; forged inputs ignored");
assert.equal(result.entries[0].power, result.power);
assert.equal(result.entries[0].displayName, "Tester");
assert.equal(result.entries[0].isYou, true);
assert.equal(result.entries[0].playerId, undefined, "user id is private");
const one = result.power;
records.Private.grind_formation_v2.Value = JSON.stringify({ version: 2, slots: ["Knight", "Archer", null] });
result = call();
assert.equal(result.power, one + expectedPower("Archer"), "two heroes, empty slot zero");
records.Private.grind_formation_v2.Value = JSON.stringify({ version: 2, slots: ["Knight", "Archer", "Mage"] });
result = call();
assert.equal(result.power, one + expectedPower("Archer") + expectedPower("Mage"), "three heroes");
records.Private.grind_formation_v2.Value = JSON.stringify({ version: 2, slots: ["Knight", null, null] });
result = call();
assert.equal(result.power, one, "bench heroes excluded; score decreases");

models.Knight.Equipment.Weapon = { ItemID: "sword", CatalogID: "Item", ItemInstanceID: "inst-1", Level: 2 };
equipment.heroes.Knight.Weapon = "inst-1";
equipment.items["inst-1"] = { ItemID: "sword", CatalogID: "Item", Level: 2 };
records.ReadOnly.grind_equipment_v1.Value = JSON.stringify(equipment);
result = call({ itemStats: { Damage: 999999 } });
assert.equal(result.power, expectedPower("Knight"), "attested Grind equipment only");
assert.ok(result.power > one, "stronger gear increases Power");
equipment.heroes.Knight.Weapon = null;
equipment.items = {};
records.ReadOnly.grind_equipment_v1.Value = JSON.stringify(equipment);
result = call();
assert.equal(result.power, one, "unequip decreases Power");

const beforeLevel = result.power;
models.Knight.StatLevels.Damage++;
result = call();
assert.equal(result.power, expectedPower("Knight"));
assert.ok(result.power > beforeLevel, "stat level changes Power");

const fake = Array.from({ length: 101 }, (_, i) => ({ playerId: `p-${i}`, power: 10000 - i,
  scoreAt: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z` }));
const sorted = context.ghTopApply(fake.slice(0, 100), { playerId: "new", power: 10001, scoreAt: "2026-01-01T00:00:00Z" });
assert.equal(sorted.length, 100);
assert.equal(sorted[0].playerId, "new");
assert.equal(sorted.some((row) => row.playerId === "p-99"), false);
const refilled = context.ghTopApply(sorted, { playerId: "replacement", power: 9999,
  scoreAt: "2026-01-01T00:00:01Z" });
const lower = context.ghTopApply(refilled, { playerId: "new", power: 1, scoreAt: "2026-01-01T00:00:01Z" });
assert.equal(lower.some((row) => row.playerId === "new"), false, "fall out of Top 100");
const tie = context.ghTopApply([{ playerId: "b", power: 10, scoreAt: "2026-01-02" }],
  { playerId: "a", power: 10, scoreAt: "2026-01-01" });
assert.equal(tie[0].playerId, "a", "earlier score wins tie");

title.value = null;
title.version = 0;
conflict = true;
result = call();
assert.equal(result.entries.length, 2, "CAS retry preserves simultaneous rival update");
assert.equal(result.entries.some((row) => row.displayName === "Rival"), true);
console.log("Secure Team Power and Top 100 tests passed");
