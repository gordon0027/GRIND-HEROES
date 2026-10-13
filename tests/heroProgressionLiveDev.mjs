// Explicit opt-in, fresh guest only. Spends starter DEV GEMS on existing GOLD offers.
import assert from "node:assert/strict";
import { createIDosGamesClient } from "@idosgames/core";
import { heroLevelCost } from "../src/modules/idle-rpg/game/heroLevel.ts";
import { fighterStats } from "../src/modules/idle-rpg/game/heroStats.ts";
import { stageHeroStats, combatPower } from "../src/modules/idle-rpg/game/equipment.ts";
import { heroArchetype } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
if (process.env.GRIND_DEV_PROGRESSION_PROBE !== "1") throw new Error("Set GRIND_DEV_PROGRESSION_PROBE=1");
const titleID = "98JRCAKG-DEV";
const client = createIDosGamesClient({ titleID, throttleMs: 0 });
const must = (r) => { assert.equal(r.ok, true, String(r.error ?? r.reason)); return r.data; };
must(await client.auth.loginWithDeviceID());
const cloud = async (name, args = {}) => { const r = must(await client.cloudCode.execute(name, args));
  assert.equal(r.Error ?? null, null, JSON.stringify(r.Error)); return r.FunctionResult; };
const refresh = async () => { must(await client.character.getUserCharacters()); must(await client.user.getUserInventory()); };
const gold = () => Number(client.data.user.state.InventoryV2.VirtualCurrencies.GOLD.Amount);
await refresh(); assert.equal(gold(), 500, "fresh guest required");
const section = client.data.config.config.Character;
assert.equal(section.Definitions.Knight.RankLadder.MaxRank, 10);
const beforeLocked = gold();
const locked = await client.character.upgradeCharacterLevel("Mage", { targetLevel: 2 });
assert.equal(locked.ok, false, "cannot upgrade unowned hero");
await refresh(); assert.equal(gold(), beforeLocked);
const concurrent = await Promise.all([1, 2].map(() => client.character.upgradeCharacterLevel("Knight", { targetLevel: 2 })));
assert.ok(concurrent.some(r => r.ok), "one concurrent upgrade succeeds");
await refresh(); assert.equal(client.data.user.state.Character.Characters.Knight.Level, 2);
assert.equal(gold(), 0, "concurrent target requests deduct only once");
assert.equal((await client.character.upgradeCharacterLevel("Knight", { targetLevel: 3 })).ok, false);
await refresh(); assert.equal(gold(), 0); assert.equal(client.data.user.state.Character.Characters.Knight.Level, 2);
const store = must(await client.store.getStorefront());
let address;
for (const shop of store.Stores ?? []) for (const section of shop.Sections ?? []) for (const slot of section.Slots ?? [])
  if (slot.Offer?.OfferID === "gold_bag_big") address = { storeID: shop.StoreID, sectionID: section.SectionID, slotID: slot.SlotID };
assert.ok(address, "existing GOLD offer must be visible");
must(await client.store.purchase("gold_bag_big", 2, { selectedOptionID: "default", slot: address }));
await refresh(); assert.equal(gold(), 50000);
must(await client.userCustomData.setPrivateData("grind_formation_v2", JSON.stringify({version:2,slots:["Knight",null,null]})));
const levels = [];
for (let target = 3; target <= 10; target++) {
  const before = gold(), cost = heroLevelCost(section.Definitions.Knight, target - 1);
  must(await client.character.upgradeCharacterLevel("Knight", { targetLevel: target }));
  await refresh(); assert.equal(gold(), before - cost, `exact cost at ${target}`);
  const model = client.data.user.state.Character.Characters.Knight;
  assert.equal(model.Level, target);
  const stats = stageHeroStats(fighterStats({ section, def: section.Definitions.Knight,
    model: {...model, Equipment:{}}, items:new Map() }), heroArchetype("Knight"),
    {attack:0,maxHp:0,defence:0,attackSpeed:0,moveSpeed:0});
  const power = await cloud("recalculateTeamPower", { power: 9999999, level: 999 });
  assert.equal(power.power, combatPower(stats), `server Power matches actual stats at ${target}`);
  levels.push({level:target,cost,gold:gold(),power:power.power});
}
const atMax = gold();
await client.character.upgradeCharacterLevel("Knight", { targetLevel: 11 });
await refresh(); assert.equal(client.data.user.state.Character.Characters.Knight.Level, 10); assert.equal(gold(), atMax);
await client.character.upgradeCharacterLevel("Knight", { targetLevel: 10 });
await refresh(); assert.equal(gold(), atMax, "stale target costs nothing");
await client.userCustomData.setPublicData("grind_team_power_v1", "9999999");
const protectedPower = await cloud("recalculateTeamPower", { power: 9999999 });
assert.equal(protectedPower.power, levels.at(-1).power, "public lookalike cannot override protected Power");
must(await client.user.getClientState()); await refresh();
assert.equal(client.data.user.state.Character.Characters.Knight.Level, 10, "state reload preserves max level");
console.log(JSON.stringify({passed:true,titleID,levels,checks:["ownership","concurrent target","insufficient funds","exact deductions","Power spoof ignored","cap","replay","state reload"]}));
process.exit(0);
