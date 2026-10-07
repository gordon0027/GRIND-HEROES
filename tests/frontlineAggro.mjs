import assert from "node:assert/strict";
import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { COMBAT_TUNING, StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";

const makeHero = (id, changes = {}) => {
  const archetype = HERO_ARCHETYPES[id] ?? HERO_ARCHETYPES.Knight;
  return { id, classId: id, level: 1, maxHp: 1000, attack: 1, defence: 0,
    attackSpeed: 1, moveSpeed: archetype.moveSpeed, attackRange: archetype.attackRange,
    combatType: archetype.combatType, projectile: archetype.projectile, ...changes };
};
const knight = makeHero("Knight");
const archer = makeHero("Archer");
const mage = makeHero("Mage");
const enemyDef = { type: "Melee Dummy", maxHp: 100000, attack: 25,
  defence: 0, attackSpeed: 2, moveSpeed: 0.36, attackRange: 0.10 };
const stage = { id: "aggro-test", name: "Aggro", length: 10, encounters: [],
  boss: { id: "aggro-boss", distance: 10, enemies: [enemyDef] } };
const slots = (members) => [1, 2, 3].map((index) => ({ index,
  unlocked: index <= members.length, hero: members[index - 1] ?? null }));
const start = (members, stageDef = stage) => {
  const run = new StageRun(stageDef);
  run.setSlots(slots(members));
  run.start();
  for (let i = 0; i < 60 && run.state !== "boss"; i++) run.tick(1 / 60);
  assert.equal(run.state, "boss");
  for (const hero of run.heroes) { hero.cooldown = 999; hero.moveSpeed = 0; }
  return run;
};
const tickUntil = (run, predicate, maxFrames = 600) => {
  for (let i = 0; i < maxFrames; i++) {
    const events = run.tick(1 / 60);
    if (predicate(events)) return events;
  }
  assert.fail("expected combat state did not occur");
};
const place = (run, positions) => {
  for (const hero of run.heroes) hero.x = positions[hero.id];
  run.enemies.forEach((enemy, index) => { enemy.x = 0.68 + index * 0.09; });
};
const attacked = (events, id) => events.some((event) =>
  event.type === "enemyAttacked" && event.targetId === id);

assert.equal(HERO_ARCHETYPES.Knight.attackRange, 0.13);
assert.ok(HERO_ARCHETYPES.Archer.attackRange > HERO_ARCHETYPES.Mage.attackRange &&
  HERO_ARCHETYPES.Mage.attackRange > HERO_ARCHETYPES.Knight.attackRange);
assert.ok(HERO_ARCHETYPES.Archer.attackRange >= 0.55);
assert.ok(HERO_ARCHETYPES.Mage.attackRange >= 0.45);
assert.ok(COMBAT_TUNING.backlineGap > 0.08);

for (const members of [[knight, archer], [knight, mage], [knight, archer, mage]]) {
  const run = start(members);
  place(run, { Knight: 0.50, Archer: 0.25, Mage: 0.17 });
  run.tick(1 / 60);
  assert.equal(run.enemies[0].targetId, "Knight", "melee enemy acquires the physical frontline");
  const rearHp = new Map(run.heroes.filter((hero) => hero.id !== "Knight")
    .map((hero) => [hero.id, hero.hp]));
  const events = tickUntil(run, (frame) => frame.some((event) => event.type === "enemyAttacked"));
  assert.ok(attacked(events, "Knight"), "the reached melee target is the Knight");
  for (const [id, hp] of rearHp)
    assert.equal(run.heroes.find((hero) => hero.id === id).hp, hp,
      `${id} cannot be damaged through the living Knight`);
}

const natural = start([knight, archer, mage]);
for (const hero of natural.heroes) hero.moveSpeed = HERO_ARCHETYPES[hero.id].moveSpeed;
const firstNaturalAttack = tickUntil(natural, (events) =>
  events.some((event) => event.type === "enemyAttacked"));
assert.ok(attacked(firstNaturalAttack, "Knight"),
  "natural movement lets the Knight intercept before the enemy's first melee hit");

const futureMelee = makeHero("Vanguard", { combatType: "MELEE", projectile: null });
const twoMelee = start([knight, futureMelee, archer]);
place(twoMelee, { Knight: 0.48, Vanguard: 0.56, Archer: 0.24 });
twoMelee.tick(1 / 60);
assert.equal(twoMelee.enemies[0].targetId, "Vanguard",
  "a future melee class can be the frontmost target without a Knight rule");

const sticky = start([knight, archer]);
place(sticky, { Knight: 0.50, Archer: 0.47 });
sticky.enemies[0].x = 0.80;
sticky.tick(1 / 60);
assert.equal(sticky.enemies[0].targetId, "Knight");
sticky.heroes.find((hero) => hero.id === "Archer").x = 0.53;
sticky.tick(1 / 60);
assert.equal(sticky.enemies[0].targetId, "Knight", "a tiny lead does not flicker aggro");
sticky.enemies[0].x = 0.60;
sticky.heroes.find((hero) => hero.id === "Archer").x = 0.505;
sticky.tick(1 / 60);
assert.equal(sticky.enemies[0].targetId, "Knight",
  "contact with nearly overlapping heroes does not flicker aggro");
sticky.enemies[0].x = 0.80;
sticky.heroes.find((hero) => hero.id === "Archer").x = 0.56;
sticky.tick(1 / 60);
assert.equal(sticky.enemies[0].targetId, "Archer", "a clear physical lead changes aggro");

const interceptedAtContact = start([knight, archer]);
place(interceptedAtContact, { Knight: 0.50, Archer: 0.48 });
interceptedAtContact.enemies[0].targetId = "Archer";
interceptedAtContact.enemies[0].x = 0.60;
const interceptEvents = interceptedAtContact.tick(1 / 60);
assert.equal(interceptedAtContact.enemies[0].targetId, "Knight",
  "even a small lead intercepts when the enemy reaches the frontline");
assert.ok(!attacked(interceptEvents, "Archer"), "melee cannot strike through that interceptor");

const fallen = start([knight, archer, mage]);
place(fallen, { Knight: 0.50, Archer: 0.25, Mage: 0.14 });
fallen.tick(1 / 60);
const fallenKnight = fallen.heroes.find((hero) => hero.id === "Knight");
fallenKnight.alive = false;
fallenKnight.hp = 0;
fallen.tick(1 / 60);
assert.equal(fallen.enemies[0].targetId, "Archer", "frontline death exposes the next living hero");
assert.ok(attacked(tickUntil(fallen, (events) => attacked(events, "Archer")), "Archer"));

const removed = start([knight, archer, mage]);
place(removed, { Knight: 0.50, Archer: 0.25, Mage: 0.14 });
removed.tick(1 / 60);
const oldDistance = removed.distance;
removed.setSlots([{ index: 1, unlocked: true, hero: null },
  { index: 2, unlocked: true, hero: archer },
  { index: 3, unlocked: true, hero: mage }]);
removed.tick(1 / 60);
assert.equal(removed.state, "boss", "live removal keeps the same encounter");
assert.equal(removed.distance, oldDistance, "live removal does not restart progress");
assert.equal(removed.enemies[0].targetId, "Archer");
assert.ok(attacked(tickUntil(removed, (events) => attacked(events, "Archer")), "Archer"));

const joined = start([archer]);
place(joined, { Archer: 0.30 });
joined.enemies[0].x = 0.72;
joined.tick(1 / 60);
assert.equal(joined.enemies[0].targetId, "Archer");
joined.setSlots([{ index: 1, unlocked: true, hero: archer },
  { index: 2, unlocked: true, hero: makeHero("Knight", { moveSpeed: 130 }) },
  { index: 3, unlocked: false, hero: null }]);
joined.heroes.find((hero) => hero.id === "Knight").cooldown = 999;
tickUntil(joined, () => joined.enemies[0].targetId === "Knight");
assert.ok(joined.heroes.find((hero) => hero.id === "Knight").x >
  joined.heroes.find((hero) => hero.id === "Archer").x + COMBAT_TUNING.aggroSwitchLead - 0.01,
  "new Knight takes aggro only after physically taking the frontline");
const archerHp = joined.heroes.find((hero) => hero.id === "Archer").hp;
assert.ok(attacked(tickUntil(joined, (events) => attacked(events, "Knight")), "Knight"));
assert.equal(joined.heroes.find((hero) => hero.id === "Archer").hp, archerHp,
  "the joined Knight protects the Archer once in front");

for (const members of [[archer], [mage], [archer, mage]]) {
  const run = start(members);
  place(run, { Archer: 0.30, Mage: 0.18 });
  run.tick(1 / 60);
  assert.equal(run.enemies[0].targetId, members.some((hero) => hero.id === "Archer")
    ? "Archer" : "Mage", "a ranged-only party still has a physical frontline");
  if (members.length === 2) {
    const front = run.heroes.find((hero) => hero.id === "Archer");
    front.alive = false;
    front.hp = 0;
    run.tick(1 / 60);
    assert.equal(run.enemies[0].targetId, "Mage", "ranged-only aggro advances after death");
  }
}

const multi = start([knight, archer, mage], { ...stage,
  boss: { ...stage.boss, enemies: [enemyDef, { ...enemyDef, type: "Second Melee Dummy" }] } });
place(multi, { Knight: 0.52, Archer: 0.27, Mage: 0.15 });
multi.tick(1 / 60);
assert.deepEqual(multi.enemies.map((enemy) => enemy.targetId), ["Knight", "Knight"],
  "multiple melee enemies can each choose the same physical frontline");

console.log("Frontline aggro, sticky interception, death/removal/join, ranged-only and multiple enemies passed");
