import assert from "node:assert/strict";
import { COMBAT_SKILLS, combatClassForHero } from "../src/modules/idle-rpg/game/combatSkills.ts";
import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { StageRun, damage } from "../src/modules/idle-rpg/game/stageRun.ts";

const source = (id) => {
  const role = HERO_ARCHETYPES[id];
  const rosterClass = { Knight: "Warrior", Archer: "Ranger", Mage: "Mage" }[id];
  return { id, classId: combatClassForHero(id, rosterClass), level: 1, maxHp: 1000, attack: 20, defence: 0,
    attackSpeed: 1, moveSpeed: role.moveSpeed, attackRange: role.attackRange,
    combatType: role.combatType, projectile: role.projectile };
};
assert.deepEqual(["Knight", "Archer", "Mage"].map((id) => source(id).classId),
  ["Knight", "Archer", "Mage"], "live roster classes resolve to skill classes");
const enemy = (defence = 0) => ({ type: "Target", maxHp: 10000, attack: 1,
  defence, attackSpeed: 1, moveSpeed: 0, attackRange: 0.1 });
const stage = (enemies, distance = 1) => ({ id: "skills", chapter: 1, stage: 1,
  name: "Skills", length: distance + 100, encounters: [
    { id: "group", distance, enemies },
  ], boss: { id: "boss", distance: distance + 100, enemies: [enemy()] } });
const start = (ids, enemies = [enemy()]) => {
  const run = new StageRun(stage(enemies));
  run.setSlots([1, 2, 3].map((index) => ({ index,
    unlocked: index <= ids.length, hero: ids[index - 1] ? source(ids[index - 1]) : null })));
  assert.equal(run.start(), true);
  for (let i = 0; i < 60 && run.state === "running"; i++) run.tick(1 / 60);
  assert.equal(run.state, "encounter");
  run.heroes.forEach((hero) => { hero.x = 0.5; });
  run.enemies.forEach((target, i) => {
    target.x = 0.61 + i * 0.045;
    target.cooldown = 999;
  });
  return run;
};
const advanceUntil = (run, predicate, maxFrames = 180) => {
  for (let i = 0; i < maxFrames; i++) {
    const events = run.tick(1 / 60);
    if (predicate(events)) return events;
  }
  assert.fail("expected combat event");
};

const knight = start(["Knight"], [enemy(4)]);
const knightHp = knight.enemies[0].hp;
const knightCast = knight.tick(1 / 60);
assert.equal(knightCast.filter((e) => e.type === "skillActivated").length, 1);
assert.equal(knight.enemies[0].hp, knightHp, "Crushing Blow has a wind-up");
const knightImpact = advanceUntil(knight, (events) => events.some((e) => e.type === "skillImpact"));
assert.ok(knightImpact.some((e) => e.type === "enemyHit" && e.attackerId === "Knight" &&
  e.skillId === COMBAT_SKILLS.Knight.id), "heavy feedback comes from the landed sword hit");
assert.equal(knightHp - knight.enemies[0].hp,
  Math.round(damage(20, 4) * COMBAT_SKILLS.Knight.damageMultiplier));
assert.ok(knight.heroes[0].skillCooldown > 7);

const archer = start(["Archer"]);
const initial = archer.tick(1 / 60);
assert.equal(initial.filter((e) => e.type === "skillActivated").length, 1);
assert.equal(archer.heroes[0].skillBuffRemaining > 0, true);
assert.equal(archer.projectiles[0].empowered, true);
let fastAttacks = initial.filter((e) => e.type === "heroAttacked").length;
for (let i = 0; i < 179; i++) fastAttacks += archer.tick(1 / 60)
  .filter((e) => e.type === "heroAttacked").length;
assert.ok(fastAttacks >= 8 && fastAttacks <= 10, `three-second rapid fire: ${fastAttacks}`);
assert.ok(archer.heroes[0].skillBuffRemaining < 1 / 30);
let normalAttacks = 0;
for (let i = 0; i < 180; i++) {
  const events = archer.tick(1 / 60);
  assert.equal(events.some((e) => e.type === "skillActivated"), false, "buff cannot stack");
  normalAttacks += events.filter((e) => e.type === "heroAttacked").length;
}
assert.ok(normalAttacks <= 4, `normal cadence restored: ${normalAttacks}`);

const mage = start(["Mage"], [enemy(4), enemy(5), enemy(6), enemy(0)]);
mage.enemies[0].x = 0.62;
mage.enemies[1].x = 0.68;
mage.enemies[2].x = 0.79;
mage.enemies[3].x = 0.94;
const hp = mage.enemies.map((e) => e.hp);
assert.equal(mage.tick(1 / 60).filter((e) => e.type === "skillActivated").length, 1);
assert.equal(mage.projectiles[0].type, "METEOR_FIREBALL");
const meteorImpact = advanceUntil(mage, (events) => events.some((e) => e.type === "skillImpact"));
assert.equal(meteorImpact.filter((e) => e.type === "enemyHit" && e.attackerId === "Mage" &&
  e.skillId === COMBAT_SKILLS.Mage.id).length, 3, "AoE feedback identifies each actual damaged target");
for (let i = 0; i < 3; i++) assert.equal(hp[i] - mage.enemies[i].hp,
  Math.round(damage(20, mage.enemies[i].defence) * COMBAT_SKILLS.Mage.damageMultiplier));
assert.equal(mage.enemies[3].hp, hp[3], "distant enemy stays outside the blast");

const deadTarget = start(["Mage"], [enemy(), enemy()]);
deadTarget.enemies[0].x = 0.61;
deadTarget.enemies[1].x = 0.7;
deadTarget.tick(1 / 60);
const survivor = deadTarget.enemies[1];
deadTarget.enemies.splice(0, 1); // Simulate another hero killing the selected target in flight.
advanceUntil(deadTarget, (events) => events.some((e) => e.type === "skillImpact"));
assert.equal(survivor.hp, 10000 - 36, "meteor explodes at its saved destination");

const party = start(["Knight", "Archer", "Mage"], [enemy(), enemy(), enemy()]);
const casts = [];
for (let i = 0; i < 120 && casts.length < 3; i++)
  casts.push(...party.tick(1 / 60).filter((e) => e.type === "skillActivated"));
assert.deepEqual(casts.map((e) => e.skillId).sort(),
  Object.values(COMBAT_SKILLS).map((skill) => skill.id).sort());
party.enemies = [];
party.tick(1 / 60);
assert.equal(party.state, "running");
assert.ok(party.heroes.find((h) => h.id === "Archer").skillBuffRemaining > 0,
  "temporary effect survives a normal encounter transition");
party.tick(10);
assert.ok(party.heroes[0].skillCooldown > 7, "hidden-tab time is capped");
party.retry();
assert.equal(party.heroes.every((hero) => hero.skillCooldown === 0 &&
  hero.skillBuffRemaining === 0), true, "retry resets skill state");
assert.equal(party.projectiles.length, 0, "retry removes projectiles");

const cleared = start(["Archer"], [enemy()]);
cleared.tick(1 / 60);
cleared.enemies = [];
cleared.tick(1 / 60);
for (let i = 0; i < 120 && cleared.state === "running"; i++) cleared.tick(1 / 60);
assert.equal(cleared.state, "boss");
cleared.enemies = [];
cleared.tick(1 / 60);
assert.equal(cleared.state, "clear");
const continued = new StageRun(stage([enemy()]));
continued.inheritSkillStateFrom(cleared);
continued.setSlots([{ index: 1, unlocked: true, hero: source("Archer") },
  { index: 2, unlocked: false, hero: null }, { index: 3, unlocked: false, hero: null }]);
continued.start();
assert.ok(continued.heroes[0].skillCooldown > 0 && continued.heroes[0].skillBuffRemaining > 0,
  "automatic farming preserves cooldown and temporary effects after a clear");
continued.retry();
assert.equal(continued.heroes[0].skillCooldown, 0, "a retry starts fresh");

const travel = new StageRun(stage([enemy()], 1000));
travel.setSlots([{ index: 1, unlocked: true, hero: source("Knight") },
  { index: 2, unlocked: false, hero: null }, { index: 3, unlocked: false, hero: null }]);
travel.start();
for (let i = 0; i < 60; i++)
  assert.equal(travel.tick(1 / 60).some((e) => e.type === "skillActivated"), false);
assert.equal(travel.heroes[0].skillCooldown, 0);

console.log("Knight damage, Archer cadence/expiry, Mage AoE/dead target, party casts, transition, retry and no-target guards passed");
