import assert from "node:assert/strict";
import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";

const hero = (id, changes = {}) => {
  const archetype = HERO_ARCHETYPES[id];
  return { id, classId: id, level: 1, maxHp: 1000, attack: 20, defence: 0,
    attackSpeed: 1, moveSpeed: archetype.moveSpeed, attackRange: archetype.attackRange,
    combatType: archetype.combatType, projectile: archetype.projectile, ...changes };
};
const knight = hero("Knight");
const archer = hero("Archer");
const mage = hero("Mage");
assert.equal(knight.combatType, "MELEE");
assert.equal(archer.projectile.type, "ARROW");
assert.equal(mage.projectile.type, "MAGIC_ORB");
assert.ok(archer.attackRange > knight.attackRange * 2.5);
assert.ok(mage.attackRange > knight.attackRange * 2);
assert.ok(archer.attackRange > mage.attackRange && mage.attackRange > knight.attackRange);

const stage = { id: "range-test", name: "Range", length: 10, encounters: [],
  boss: { id: "range-boss", distance: 10, enemies: [{ type: "Dummy", maxHp: 1000,
    attack: 0, defence: 0, attackSpeed: 0.1, moveSpeed: 0, attackRange: 0.1 }] } };
const slots = (members) => [1, 2, 3].map((index) => ({ index,
  unlocked: index <= members.length, hero: members[index - 1] ?? null }));
const start = (members, definition = stage) => {
  const run = new StageRun(definition);
  run.setSlots(slots(members));
  run.start();
  for (let i = 0; i < 60 && run.state !== "boss"; i++) run.tick(1 / 60);
  assert.equal(run.state, "boss");
  return run;
};
const until = (run, predicate, maxFrames = 600) => {
  for (let i = 0; i < maxFrames; i++) {
    const events = run.tick(1 / 60);
    if (predicate(events)) return events;
  }
  assert.fail("expected combat event did not occur");
};

for (const members of [[knight, archer], [knight, mage], [knight, archer, mage]]) {
  const run = start(members);
  const fired = new Set();
  for (let i = 0; i < 240 && fired.size < members.length; i++) {
    for (const event of run.tick(1 / 60)) if (event.type === "heroAttacked") fired.add(event.id);
    const front = run.heroes.find((entry) => entry.id === "Knight");
    for (const ranged of run.heroes.filter((entry) => entry.combatType === "RANGED" &&
        fired.has(entry.id))) {
      assert.ok(front.x - ranged.x >= 0.13,
        `${ranged.id} fires well behind the living Knight frontline`);
      assert.ok(run.enemies[0].x - ranged.x >= (ranged.id === "Archer" ? 0.46 : 0.40),
        `${ranged.id} fires from substantially farther away than V1`);
    }
  }
  assert.deepEqual(fired, new Set(members.map((entry) => entry.id)),
    "frontline and backline all attack independently");
  if (members.length === 3)
    assert.ok(Math.abs(run.heroes.find((entry) => entry.id === "Archer").x -
      run.heroes.find((entry) => entry.id === "Mage").x) >= 0.025,
    `the two ranged positions retain a staggered backline: ${run.heroes.map((h) => `${h.id}=${h.x}`).join(", ")}`);
}

for (const members of [[archer], [mage], [archer, mage]]) {
  const run = start(members);
  until(run, (events) => events.some((event) => event.type === "heroAttacked"));
  const firing = run.heroes.find((entry) => run.projectiles.some((shot) => shot.attackerId === entry.id));
  assert.ok(firing, "a ranged-only party fires without Knight");
  assert.ok(run.enemies[0].x - firing.x >= 0.40,
    "a ranged hero stops before melee contact");
}

const delayed = start([archer]);
const fullHp = delayed.enemies[0].hp;
until(delayed, (events) => events.some((event) => event.type === "heroAttacked"));
assert.equal(delayed.enemies[0].hp, fullHp, "damage does not occur at fire start");
assert.equal(delayed.projectiles.length, 1);
const first = delayed.projectiles[0];
assert.ok(first.elapsed < 0 && first.travelDuration > 0);
const damageAtFire = first.damageSnapshot;
delayed.setSlots(slots([{ ...archer, attack: 200 }]));
assert.equal(delayed.projectiles[0].damageSnapshot, damageAtFire,
  "live equipment changes cannot alter a shot already fired");
until(delayed, () => delayed.projectiles.length === 0);
assert.equal(delayed.enemies[0].hp, fullHp - damageAtFire,
  "snapshotted damage resolves only when the projectile arrives");
until(delayed, () => delayed.projectiles.length > 0);
assert.ok(delayed.projectiles[0].damageSnapshot > damageAtFire,
  "the next projectile uses the new attack stat");

const benched = start([knight, archer]);
benched.heroes[0].cooldown = 999;
until(benched, () => benched.projectiles.length > 0);
const benchShot = benched.projectiles[0];
const benchHp = benched.enemies[0].hp;
benched.setSlots([{ index: 1, unlocked: true, hero: knight },
  { index: 2, unlocked: true, hero: null }, { index: 3, unlocked: false, hero: null }]);
assert.equal(benched.projectiles[0], benchShot, "bench does not delete an already-fired shot");
until(benched, () => benched.projectiles.length === 0);
assert.equal(benched.enemies[0].hp, benchHp - benchShot.damageSnapshot);

const twoTargets = { ...stage, id: "two-targets", boss: { ...stage.boss,
  enemies: [stage.boss.enemies[0], { ...stage.boss.enemies[0], type: "Second Dummy" }] } };
const lostTarget = start([knight, archer], twoTargets);
lostTarget.heroes[0].cooldown = 999;
until(lostTarget, () => lostTarget.projectiles.length > 0);
const untouchedHp = lostTarget.enemies[1].hp;
lostTarget.heroes[0].cooldown = 0;
lostTarget.heroes[0].attack = 2000;
lostTarget.heroes[0].x = lostTarget.enemies[0].x - knight.attackRange;
const killEvents = until(lostTarget, (events) =>
  events.some((event) => event.type === "enemyDefeated"));
assert.equal(killEvents.filter((event) => event.type === "enemyDefeated").length, 1);
assert.equal(lostTarget.enemies.length, 1);
assert.equal(lostTarget.enemies[0].hp, untouchedHp,
  "a projectile aimed at the dead enemy cannot damage a second target");
assert.equal(lostTarget.projectiles.length, 0, "a dead target cancels its projectile without retargeting");

const overlap = start([hero("Archer", { attackSpeed: 5,
  projectile: { type: "ARROW", speed: 0.1, releaseDelay: 0.18 } })]);
until(overlap, () => overlap.projectiles.length >= 2);
assert.equal(overlap.enemies[0].hp, fullHp,
  "attack cadence can launch a second shot while the first is still traveling");
assert.ok(overlap.projectiles[0].id !== overlap.projectiles[1].id);
overlap.retry();
assert.equal(overlap.projectiles.length, 0, "new run clears every old projectile");

const speedChange = start([hero("Archer", { projectile: {
  type: "ARROW", speed: 0.1, releaseDelay: 0.18 } })]);
until(speedChange, () => speedChange.projectiles.length > 0);
const inFlight = speedChange.projectiles[0];
speedChange.setSlots(slots([hero("Archer", { attackSpeed: 5, projectile: {
  type: "ARROW", speed: 0.1, releaseDelay: 0.18 } })]));
assert.equal(speedChange.projectiles[0], inFlight,
  "live Attack Speed change preserves the existing projectile");
until(speedChange, () => speedChange.projectiles.length >= 2);
assert.ok(speedChange.projectiles.some((shot) => shot.id === inFlight.id),
  "the new cadence can fire while the original arrow is in flight");

const fallen = start([knight, archer]);
fallen.heroes[0].cooldown = 999;
until(fallen, () => fallen.projectiles.length > 0);
const arrow = fallen.projectiles[0];
fallen.heroes[1].alive = false;
fallen.heroes[1].hp = 0;
until(fallen, () => fallen.projectiles.length === 0);
assert.equal(fallen.enemies[0].hp, fullHp - arrow.damageSnapshot,
  "a projectile fired before death still resolves");
assert.ok(!fallen.tick(1 / 60).some((event) => event.type === "heroAttacked" && event.id === "Archer"),
  "a dead ranged hero cannot launch another shot");

console.log("Ranged roles, formation, delayed hits, snapshots, overlap and cleanup passed");
