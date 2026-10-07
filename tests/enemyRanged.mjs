import assert from "node:assert/strict";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";

const hero = (id, x = 0) => ({ id, classId: id, level: 1, maxHp: 100,
  attack: 1, defence: 0, attackSpeed: 1, moveSpeed: 1000, attackRange: 0.1,
  combatType: "MELEE", projectile: null, x });
const melee = { type: "Guard", maxHp: 1000, attack: 0, defence: 0,
  attackSpeed: 0.1, moveSpeed: 0, attackRange: 0.1 };
const bow = { type: "Archer", maxHp: 1000, attack: 7, defence: 0,
  attackSpeed: 0.7, moveSpeed: 0.32, attackRange: 0.42, combatType: "RANGED",
  projectile: { type: "ARROW", speed: 1.35, releaseDelay: 0.19 } };
const stage = (enemies) => ({ id: "enemy-range", name: "Enemy range", length: 20,
  encounters: [{ id: "wave", distance: 10, enemies }],
  boss: { id: "boss", distance: 20, enemies: [melee] } });
const start = (members, enemies) => {
  const run = new StageRun(stage(enemies));
  run.setSlots([1, 2, 3].map((index) => ({ index, unlocked: index <= members.length,
    hero: members[index - 1] ?? null })));
  run.start();
  for (let i = 0; i < 60 && run.state !== "encounter"; i++) run.tick(1 / 60);
  assert.equal(run.state, "encounter");
  for (const member of run.heroes) { member.cooldown = 999; member.moveSpeed = 0; }
  return run;
};
const until = (run, predicate) => {
  for (let i = 0; i < 360; i++) {
    const events = run.tick(1 / 60);
    if (predicate(events)) return events;
  }
  assert.fail("expected ranged event was not reached");
};

const mixed = start([hero("Knight"), hero("Archer")], [melee, bow]);
mixed.heroes.find((entry) => entry.id === "Knight").x = 0.50;
mixed.heroes.find((entry) => entry.id === "Archer").x = 0.20;
mixed.enemies[0].x = 0.65;
mixed.enemies[1].x = 0.90;
const archerX = mixed.enemies[1].x;
const backlineHp = mixed.heroes[1].hp;
const first = until(mixed, (events) => events.some((event) =>
  event.type === "enemyAttackStarted" && event.id === mixed.enemies[1].id));
assert.equal(first.find((event) => event.type === "enemyAttackStarted" &&
  event.id === mixed.enemies[1].id).targetId, "Knight");
assert.equal(mixed.enemies[1].x, archerX, "archer holds its ranged position behind the guard");
assert.ok(mixed.enemies[1].x - mixed.enemies[0].x >= 0.12);
assert.equal(mixed.enemyProjectiles.length, 1);
assert.ok(mixed.enemyProjectiles[0].elapsed < 0, "arrow releases after attack animation begins");
assert.equal(mixed.heroes[0].hp, 100, "launch does not apply immediate damage");
const arrived = until(mixed, (events) => events.some((event) =>
  event.type === "enemyAttacked" && event.id === mixed.enemies[1].id));
assert.equal(arrived.find((event) => event.type === "enemyAttacked" &&
  event.id === mixed.enemies[1].id).targetId, "Knight");
assert.equal(mixed.heroes[0].hp, 93);
assert.equal(mixed.heroes[1].hp, backlineHp, "frontline prevents backline damage");

const solo = start([hero("Knight")], [bow]);
solo.heroes[0].x = 0.24;
until(solo, () => solo.enemyProjectiles.length > 0);
assert.ok(solo.enemies[0].x - solo.heroes[0].x >= 0.40,
  "an archer without melee allies stops at long range");
solo.retry();
assert.equal(solo.enemyProjectiles.length, 0, "a new run clears enemy arrows");

const canceled = start([hero("Knight"), hero("Archer")], [melee, bow]);
canceled.heroes[0].x = 0.50;
canceled.heroes[1].x = 0.20;
canceled.enemies[0].x = 0.65;
canceled.enemies[1].x = 0.90;
until(canceled, () => canceled.enemyProjectiles.length > 0);
canceled.heroes[0].alive = false;
canceled.heroes[0].hp = 0;
canceled.tick(1 / 60);
assert.equal(canceled.enemyProjectiles.length, 0,
  "a dead target cancels an existing arrow instead of hitting the backline");
until(canceled, () => canceled.enemies[1].targetId === "Archer");

console.log("Enemy ranged distance, frontline targeting, delayed arrows and cleanup passed");
