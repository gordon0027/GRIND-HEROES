import assert from "node:assert/strict";
import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { combatPower, gearBonuses, stageHeroStats } from "../src/modules/idle-rpg/game/equipment.ts";
import { simulate } from "./balanceSweep.mjs";
import { families, gearRows, rarities, rarityTables, requiredLevels } from "./itemBalanceV1.mjs";

assert.equal(gearRows.length, 50);
assert.equal(new Set(gearRows.map(row => row.id)).size, 50);
for (const info of Object.values(families)) assert.equal(info.ids.length, 5);
for (const [key, percentages] of Object.entries(rarityTables)) {
  assert.equal(percentages.reduce((a, b) => a + b, 0), 100, key);
  const kind = key.replace("stage", "boss");
  if (kind === key) continue;
  const better = rarityTables[kind];
  for (let tier = 1; tier < 5; tier++)
    assert.ok(better.slice(tier).reduce((a, b) => a + b, 0) >=
      percentages.slice(tier).reduce((a, b) => a + b, 0), `${key}: boss tier ${tier}`);
}
assert.equal(rarityTables.act1_stage[3] + rarityTables.act1_stage[4], 0);
assert.equal(rarityTables.act1_boss[4], 0);
assert.equal(rarityTables.act2_stage[4], 0);

const slots = ["helmet", "armor", "gloves", "boots"];
const gearFor = (heroID, tier) => {
  const classSlots = heroID === "Knight" ? ["sword", "shield"] :
    heroID === "Archer" ? ["bow", "quiver"] : ["staff", "orb"];
  return [...slots, ...classSlots].reduce((sum, family) => {
    const flat = families[family].stats[tier];
    const value = gearBonuses({ Stats: { FlatBonuses: flat } });
    for (const key of Object.keys(sum)) sum[key] += value[key];
    return sum;
  }, { attack: 0, maxHp: 0, defence: 0, attackSpeed: 0, moveSpeed: 0 });
};
const base = { Knight: [120, 10, 1], Archer: [90, 9, 1.4], Mage: [80, 22, 0.8] };
// Paid stat enhancements are separate from stage-earned Hero Level.
const enhances = [0, 3, 8, 14, 20];
const fighter = (heroID, tier, enhanceOverride) => {
  const [hp, damage, attackSpeed] = base[heroID];
  const role = HERO_ARCHETYPES[heroID];
  const plus = enhanceOverride ?? enhances[tier];
  const stats = stageHeroStats({ maxHp: hp + plus * (heroID === "Knight" ? 24 : 18),
    damage: damage + plus * (heroID === "Mage" ? 4.4 : heroID === "Knight" ? 2 : 1.8),
    armor: 0, attackSpeed, critChance: 0, critMultiplier: 1.5, dodge: 0, regen: 0,
    multiShot: 0 }, role, gearFor(heroID, tier));
  return { id: heroID, classId: heroID, level: requiredLevels[tier], ...stats,
    combatType: role.combatType, projectile: role.projectile };
};
const cases = [
  [0, ["Knight"], 1, 1],
  [1, ["Knight", "Archer"], 1, 10],
  [2, ["Knight", "Archer", "Mage"], 2, 10],
  [3, ["Knight", "Archer", "Mage"], 3, 5],
  [4, ["Knight", "Archer", "Mage"], 3, 10],
];
for (const [tier, heroes, act, stage] of cases) {
  const party = heroes.map(heroID => fighter(heroID, tier));
  const result = simulate(act, stage, party);
  const power = party.reduce((sum, member) => sum + combatPower(member), 0);
  console.log(JSON.stringify({ tier: rarities[tier], heroLevel: requiredLevels[tier],
    stage: result.stage, power, result: result.result, seconds: result.seconds,
    deaths: result.deaths, hp: result.hp }));
  assert.equal(result.result, "clear", `${rarities[tier]} should clear ${result.stage}`);
}
for (const tier of [0, 1, 2]) {
  const party = (tier === 0 ? ["Knight"] : tier === 1 ? ["Knight", "Archer"] :
    ["Knight", "Archer", "Mage"]).map(id => fighter(id, tier));
  const future = simulate(tier + 1, 10, party);
  console.log(JSON.stringify({ futureWith: rarities[tier], stage: future.stage,
    result: future.result, seconds: future.seconds, deaths: future.deaths }));
}
let previous = null;
for (const tier of [0, 1, 2, 3, 4]) {
  const party = ["Knight", "Archer", "Mage"].map(id => fighter(id, tier, 8));
  const result = simulate(3, 5, party);
  const power = party.reduce((sum, member) => sum + combatPower(member), 0);
  const survivingHp = result.hp.reduce((sum, hp) => sum + hp, 0);
  console.log(JSON.stringify({ fixedBaseGear: rarities[tier], stage: result.stage,
    result: result.result, seconds: result.seconds, deaths: result.deaths,
    survivingHp, power }));
  if (previous) {
    assert.ok(result.seconds < previous.seconds, "higher tier should clear faster with equal paid stats");
    assert.ok(survivingHp > previous.survivingHp, "higher tier should retain more HP");
    assert.ok(power > previous.power, "higher tier should increase Power");
  }
  previous = { seconds: result.seconds, survivingHp, power };
}
console.log("50-item matrix, chest dominance, and tier combat passed");
