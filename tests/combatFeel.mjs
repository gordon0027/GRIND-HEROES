import assert from "node:assert/strict";
import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { ATTACK_TIMING, baseEventDelay, scaledEventDelay } from
  "../src/modules/idle-rpg/game/combatTiming.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";
import { WorldPresentation, projectWorldX } from
  "../src/modules/idle-rpg/game/worldPresentation.ts";

const hero = (id, overrides = {}) => {
  const config = HERO_ARCHETYPES[id];
  return { id, classId: id, level: 1, maxHp: 100, attack: 20, defence: 0,
    attackSpeed: 1, moveSpeed: config.moveSpeed, attackRange: config.attackRange,
    combatType: config.combatType, projectile: config.projectile, ...overrides };
};
const enemy = (overrides = {}) => ({ type: "Goblin", maxHp: 1000, attack: 20,
  defence: 0, attackSpeed: 1, moveSpeed: 0, attackRange: 0.12, ...overrides });
const stage = (enemyDef = enemy()) => ({ id: "feel", chapter: 1, stage: 1,
  name: "Feel", length: 100, encounters: [
    { id: "first", distance: 0.5, enemies: [enemyDef] },
  ], boss: { id: "boss", distance: 100, enemies: [enemy({ type: "Boss" })] } });
const start = (members, definition = stage()) => {
  const run = new StageRun(definition);
  run.setSlots([1, 2, 3].map((index) => ({ index,
    unlocked: index <= members.length, hero: members[index - 1] ?? null })));
  run.start();
  for (let i = 0; i < 120 && run.state === "running"; i++) run.tick(1 / 60);
  assert.equal(run.state, "encounter");
  return run;
};
const until = (run, predicate, limit = 180) => {
  for (let i = 0; i < limit; i++) {
    const events = run.tick(1 / 60);
    if (predicate(events)) return { events, frames: i + 1 };
  }
  assert.fail("expected timed combat event");
};

const knight = start([hero("Knight", { attack: 50 })]);
knight.heroes[0].x = 0.5;
knight.enemies[0].x = 0.61;
knight.enemies[0].cooldown = 999;
const initialEnemyHp = knight.enemies[0].hp;
assert.ok(knight.tick(1 / 60).some((event) => event.type === "heroAttacked"));
assert.equal(knight.enemies[0].hp, initialEnemyHp, "sword wind-up does not deal frame-zero damage");
const knightImpact = until(knight, (events) => events.some((event) => event.type === "enemyHit"));
assert.ok(knightImpact.frames >= 20 && knightImpact.frames <= 30,
  "Knight impact lands near source frame 32");
assert.equal(knight.enemies[0].hp, initialEnemyHp - 50);

const incoming = start([hero("Knight", { attack: 0 })]);
incoming.heroes[0].x = 0.5;
incoming.heroes[0].cooldown = 999;
incoming.enemies[0].x = 0.61;
const initialHeroHp = incoming.heroes[0].hp;
assert.ok(incoming.tick(1 / 60).some((event) => event.type === "enemyAttackStarted"));
assert.equal(incoming.heroes[0].hp, initialHeroHp,
  "enemy attack starts before its actual contact and HP change");
const enemyImpact = until(incoming, (events) => events.some((event) => event.type === "enemyAttacked"));
assert.ok(enemyImpact.frames >= 17 && enemyImpact.frames <= 25,
  "normal enemy impact lands near source frame 30");
assert.equal(incoming.heroes[0].hp, initialHeroHp - 20);

const bossStage = { id: "boss-feel", chapter: 1, stage: 1, name: "Boss Feel",
  length: 0.5, encounters: [], boss: { id: "boss", distance: 0.5,
    enemies: [enemy({ type: "Ogre", attackSpeed: 1 })] } };
const bossRun = new StageRun(bossStage);
bossRun.setSlots([{ index: 1, unlocked: true, hero: hero("Knight", { attack: 0 }) },
  { index: 2, unlocked: false, hero: null },
  { index: 3, unlocked: false, hero: null }]);
bossRun.start();
until(bossRun, () => bossRun.state === "boss");
bossRun.heroes[0].x = 0.5;
bossRun.heroes[0].cooldown = 999;
bossRun.enemies[0].x = 0.61;
assert.ok(bossRun.tick(1 / 60).some((event) => event.type === "enemyAttackStarted"));
assert.equal(bossRun.heroes[0].hp, 100);
const bossImpact = until(bossRun, (events) =>
  events.some((event) => event.type === "enemyAttacked"));
assert.ok(bossImpact.frames >= 33 && bossImpact.frames <= 43,
  "boss club contact is later in its source attack row");
assert.equal(bossRun.heroes[0].hp, 80);
bossRun.enemies[0].attack = 999;
bossRun.enemies[0].cooldown = 0;
until(bossRun, (events) => events.some((event) => event.type === "heroDied"));
assert.equal(bossRun.heroes[0].state, "dead");
assert.equal(bossRun.state, "failed");
assert.deepEqual(bossRun.tick(1 / 60), [], "hero death is terminal until a new run");

for (const id of ["Archer", "Mage"]) {
  const ranged = start([hero(id, { attack: 15 })]);
  ranged.enemies[0].cooldown = 999;
  const initialHp = ranged.enemies[0].hp;
  const shotStarted = until(ranged, (events) =>
    events.some((event) => event.type === "heroAttacked"));
  assert.ok(shotStarted.events.some((event) => event.type === "heroAttacked"));
  const shot = ranged.projectiles[0];
  assert.ok(shot.elapsed < 0);
  assert.ok(Math.abs(-shot.elapsed - HERO_ARCHETYPES[id].projectile.releaseDelay) < 0.04,
    `${id} releases near its configured source frame`);
  until(ranged, () => shot.elapsed >= 0);
  assert.equal(ranged.enemies[0].hp, initialHp,
    `${id} projectile release still precedes damage`);
  const hit = until(ranged, (events) => events.some((event) => event.type === "enemyHit"));
  assert.equal(hit.events.find((event) => event.type === "enemyHit").source,
    HERO_ARCHETYPES[id].projectile.type);
  assert.equal(ranged.enemies[0].hp, initialHp - 15,
    `${id} HP change occurs on projectile impact`);
}

const removable = start([hero("Knight", { attack: 0 }), hero("Archer", { attack: 0 })]);
removable.heroes[0].x = 0.5;
removable.heroes[1].x = 0.2;
removable.heroes.forEach((member) => { member.cooldown = 999; member.moveSpeed = 0; });
removable.enemies[0].x = 0.61;
assert.ok(removable.tick(1 / 60).some((event) => event.type === "enemyAttackStarted"));
const archerHp = removable.heroes[1].hp;
removable.setSlots([{ index: 1, unlocked: true, hero: null },
  { index: 2, unlocked: true, hero: hero("Archer", { attack: 0, moveSpeed: 0 }) },
  { index: 3, unlocked: false, hero: null }]);
for (let i = 0; i < 35; i++) removable.tick(1 / 60);
assert.equal(removable.heroes[0].hp, archerHp,
  "a removed frontline cancels its wind-up, never transferring damage to backline");
assert.equal(removable.enemies[0].targetId, "Archer");

const fatal = start([hero("Knight", { attack: 2000 })]);
fatal.heroes[0].x = 0.5;
fatal.enemies[0].x = 0.61;
fatal.enemies[0].cooldown = 999;
const dead = fatal.enemies[0];
const world = new WorldPresentation();
world.update(fatal, 0, 390);
const deathWorldX = world.enemyWorldX(dead.id);
fatal.tick(1 / 60);
const death = until(fatal, (events) => events.some((event) => event.type === "enemyDefeated"));
assert.ok(death.events.some((event) => event.type === "enemyHit" && event.source === "MELEE"));
world.update(fatal, 1 / 60, 390);
assert.equal(dead.alive, false);
assert.equal(dead.state, "dead");
assert.equal(dead.targetId, null);
const deathLaneX = dead.x;
const screenAtDeath = projectWorldX(deathWorldX, world.cameraWorldX, 390);
for (let i = 0; i < 120 && fatal.state === "running"; i++) {
  const events = fatal.tick(1 / 60);
  world.update(fatal, 1 / 60, 390);
  assert.ok(!events.some((event) => event.type === "enemyAttacked" && event.id === dead.id));
  assert.equal(dead.x, deathLaneX, "dead enemy never receives living movement");
  assert.equal(dead.targetId, null, "dead enemy never reacquires a target");
}
assert.equal(fatal.state, "boss", "death presentation does not block the next encounter");
assert.ok(projectWorldX(deathWorldX, world.cameraWorldX, 390) < screenAtDeath,
  "the death world coordinate is fixed while the corpse scrolls left with the camera");

assert.ok(HERO_ARCHETYPES.Archer.projectile.releaseDelay > 0.25);
assert.ok(HERO_ARCHETYPES.Mage.projectile.releaseDelay >
  HERO_ARCHETYPES.Archer.projectile.releaseDelay);
assert.equal(HERO_ARCHETYPES.Archer.projectile.releaseDelay,
  baseEventDelay(ATTACK_TIMING.hero.Archer));
assert.ok(scaledEventDelay(ATTACK_TIMING.hero.Knight, 5) <
  scaledEventDelay(ATTACK_TIMING.hero.Knight, 1),
  "high Attack Speed scales the impact beat without imposing a fixed slow animation");

console.log("Attack wind-ups, impact-only HP changes, canceled attacks, dead world anchors and next encounter passed");
