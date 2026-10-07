import assert from "node:assert/strict";
import { FIRST_STAGE, StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";
import { assignFormation, defaultFormation, partyCapacity, restoreFormation } from "../src/modules/idle-rpg/game/formation.ts";

const knight = { id: "Knight", classId: "Warrior", level: 1, maxHp: 120,
  attack: 10, defence: 0, attackSpeed: 1, moveSpeed: 70, attackRange: 0.13,
  combatType: "MELEE", projectile: null };
const party = (members) => [1, 2, 3].map((index) => ({
  index, unlocked: index <= members.length, hero: members[index - 1] ?? null,
}));

const run = new StageRun(FIRST_STAGE);
run.setSlots(party([knight]));
assert.equal(run.start(), true);
const reached = [];
let pausedFrames = 0;
for (let frame = 0; frame < 12000 && run.state !== "clear" && run.state !== "failed"; frame++) {
  const before = run.distance;
  const state = run.state;
  for (const event of run.tick(1 / 60)) {
    if (event.type === "encounterStarted") reached.push([event.id, run.distance]);
  }
  if (state === "encounter" || state === "boss") {
    assert.equal(run.distance, before, "combat must block distance");
    pausedFrames++;
  }
}
assert.equal(run.state, "clear", "Knight must clear the complete V1 stage");
assert.deepEqual(reached.map(([id]) => id), [...FIRST_STAGE.encounters, FIRST_STAGE.boss].map((e) => e.id));
assert.deepEqual(reached.map(([, distance]) => distance), [750, 1750, 3000, 4100, 5000]);
assert.ok(pausedFrames > 0);
assert.ok(run.completionSeconds > 0);
assert.equal(run.distance, 5000);
assert.equal(run.retry(), true);
assert.equal(run.state, "running");
assert.equal(run.distance, 0);
assert.equal(run.elapsedSeconds, 0);
assert.equal(run.enemies.length, 0);
assert.equal(run.heroes[0].hp, run.heroes[0].maxHp);
assert.equal(run.heroes[0].targetId, null);

const travelStage = { id: "travel", name: "Travel", length: 1000, encounters: [],
  boss: { id: "boss", distance: 1000, enemies: [{ type: "Test", maxHp: 10, attack: 1,
    defence: 0, attackSpeed: 1, moveSpeed: 0, attackRange: 0.1 }] } };
const slow = new StageRun(travelStage);
const fast = new StageRun(travelStage);
slow.setSlots(party([{ ...knight, moveSpeed: 50 }]));
fast.setSlots(party([{ ...knight, moveSpeed: 100 }]));
slow.start(); fast.start();
for (let i = 0; i < 300; i++) { slow.tick(1 / 60); fast.tick(1 / 60); }
assert.ok(Math.abs(slow.distance - 250) < 0.01);
assert.ok(Math.abs(fast.distance - 500) < 0.01);
slow.heroes[0].x = 0.5;
fast.heroes[0].x = 0.5;
slow.tick(1 / 60);
fast.tick(1 / 60);
assert.ok(fast.heroes[0].x < slow.heroes[0].x,
  "higher Move Speed reforms toward travel position faster");

const fatalStage = { ...travelStage, id: "fatal", length: 10,
  boss: { id: "fatal-boss", distance: 10, enemies: [{ type: "Test Boss", maxHp: 1000,
    attack: 500, defence: 0, attackSpeed: 5, moveSpeed: 0.3, attackRange: 0.13 }] } };
const doomed = new StageRun(fatalStage);
doomed.setSlots(party([
  { ...knight, id: "Knight", maxHp: 20 },
  { ...knight, id: "Archer", maxHp: 20 },
  { ...knight, id: "Mage", maxHp: 20 },
]));
doomed.start();
const deaths = [];
for (let i = 0; i < 1200 && doomed.state !== "failed"; i++) {
  for (const event of doomed.tick(1 / 60)) if (event.type === "heroDied") deaths.push(event.id);
}
assert.equal(doomed.state, "failed", "failure requires the whole active party to die");
assert.deepEqual(new Set(deaths), new Set(["Knight", "Archer", "Mage"]));
assert.equal(doomed.retry(), true);
assert.equal(doomed.state, "running");
assert.equal(doomed.distance, 0);
assert.ok(doomed.heroes.every((hero) => hero.alive && hero.hp === hero.maxHp));

const soloDoomed = new StageRun(fatalStage);
soloDoomed.setSlots(party([{ ...knight, maxHp: 20 }]));
soloDoomed.start();
for (let i = 0; i < 1200 && soloDoomed.state !== "failed"; i++) soloDoomed.tick(1 / 60);
assert.equal(soloDoomed.state, "failed", "a solo party fails when its only hero dies");

const owned = new Set(["Knight", "Archer", "Mage"]);
const formation = defaultFormation(owned);
assert.deepEqual(formation.slots, ["Knight", null, null]);
assert.equal(partyCapacity("2"), 2);
assert.equal(partyCapacity("4"), 1);
assert.equal(assignFormation(formation, 2, "Archer", owned, 1), null, "locked slot rejects hero");
assert.equal(assignFormation(formation, 2, "Knight", owned, 2), null, "duplicate hero rejected");
assert.equal(assignFormation(formation, 1, "Mage", new Set(["Knight"]), 1), null, "unowned hero rejected");
assert.equal(assignFormation(formation, 1, null, owned, 1), null, "last active hero cannot be removed");
const twoFormation = assignFormation(formation, 2, "Archer", owned, 2);
assert.ok(twoFormation);
assert.deepEqual(assignFormation(twoFormation, 2, null, owned, 2), formation,
  "an extra hero can be removed without emptying the party");
const threeFormation = assignFormation(twoFormation, 3, "Mage", owned, 3);
assert.ok(threeFormation);
assert.deepEqual(restoreFormation(JSON.stringify(threeFormation), owned, 3), threeFormation,
  "iDos string roundtrip restores all assignments");
assert.deepEqual(restoreFormation(JSON.stringify(threeFormation), owned, 1), formation,
  "saved assignment cannot bypass a locked party slot");
assert.deepEqual(restoreFormation('{broken', owned, 3), formation);

const formationStage = { id: "formation-test", name: "Formation", length: 10, encounters: [],
  boss: { id: "test-boss", distance: 10, enemies: [{ type: "Dummy", maxHp: 1000,
    attack: 0, defence: 0, attackSpeed: 0.2, moveSpeed: 0, attackRange: 0.1 }] } };
const archer = { ...knight, id: "Archer", classId: "Ranger", moveSpeed: 75, attackRange: 0.38,
  combatType: "RANGED", projectile: { type: "ARROW", speed: 1.5, releaseDelay: 0.18 } };
const mage = { ...knight, id: "Mage", classId: "Mage", moveSpeed: 60, attackRange: 0.32,
  combatType: "RANGED", projectile: { type: "MAGIC_ORB", speed: 1.1, releaseDelay: 0.18 } };

const moving = new StageRun(travelStage);
moving.setSlots(party([{ ...knight, moveSpeed: 65 }, archer, mage]));
moving.start();
for (let i = 0; i < 60; i++) moving.tick(1 / 60);
const metres = Object.fromEntries(moving.heroes.map((h) => [h.id, h.travelDistance]));
assert.ok(metres.Archer > metres.Knight && metres.Knight > metres.Mage,
  "all three heroes move at individual speeds");
assert.ok(Math.max(...Object.values(metres)) - Math.min(...Object.values(metres)) <= 12.001,
  "cohesion bounds separation to 12 metres");
assert.equal(moving.distance, metres.Archer, "stage progress follows the first arrival without a camera jump");

const arrivalStage = { ...travelStage, id: "arrival", encounters: [{ ...travelStage.boss,
  id: "arrival-encounter", distance: 100 }] };
const arrival = new StageRun(arrivalStage);
arrival.setSlots(party([{ ...knight, moveSpeed: 65 }, archer, mage]));
arrival.start();
for (let i = 0; i < 300 && arrival.state !== "encounter"; i++) arrival.tick(1 / 60);
assert.equal(arrival.state, "encounter");
assert.equal(arrival.distance, 100);
assert.ok(arrival.heroes.find((h) => h.id === "Archer").x >
  arrival.heroes.find((h) => h.id === "Mage").x,
  "the faster hero reaches the fight ahead of the slower hero");
assert.ok(arrival.heroes.find((h) => h.id === "Mage").travelDistance < 100,
  "a trailing hero may join after the encounter starts");

const rangeRun = new StageRun(formationStage);
rangeRun.setSlots(party([knight, archer]));
rangeRun.start();
for (let i = 0; i < 100 && rangeRun.state !== "boss"; i++) rangeRun.tick(1 / 60);
assert.equal(rangeRun.state, "boss");
const firstHits = [];
for (let i = 0; i < 120 && firstHits.length < 2; i++) {
  for (const event of rangeRun.tick(1 / 60)) if (event.type === "heroAttacked" && !firstHits.includes(event.id)) firstHits.push(event.id);
}
assert.deepEqual(firstHits, ["Archer", "Knight"], "ranged hero attacks before melee hero closes");
assert.ok(rangeRun.heroes.every((h) => h.targetId !== null), "both heroes acquire targets");

const survivorStage = { ...formationStage, id: "survivor", boss: { ...formationStage.boss,
  enemies: [{ type: "Assassin", maxHp: 250, attack: 500, defence: 0, attackSpeed: 1,
    moveSpeed: 0.8, attackRange: 0.15 }] } };
const survivors = new StageRun(survivorStage);
survivors.setSlots(party([{ ...knight, maxHp: 10, attack: 1, attackRange: 0.13, moveSpeed: 150 },
  { ...archer, maxHp: 10000, attack: 100 }]));
survivors.start();
const attacks = new Set();
let knightDied = false;
let enemyRetargeted = false;
for (let i = 0; i < 900 && survivors.state !== "clear" && survivors.state !== "failed"; i++) {
  for (const event of survivors.tick(1 / 60)) {
    if (event.type === "heroAttacked") attacks.add(event.id);
    if (event.type === "heroDied" && event.id === "Knight") knightDied = true;
  }
  if (knightDied && survivors.enemies.some((enemy) => enemy.targetId === "Archer")) enemyRetargeted = true;
}
assert.ok(knightDied, "one party member can die");
assert.ok(enemyRetargeted, "enemy switches to a living hero after its target dies");
assert.equal(survivors.state, "clear", "a surviving party member can finish the run");
assert.ok(attacks.has("Archer"));

const trio = new StageRun(formationStage);
trio.setSlots(party([knight, archer, mage]));
trio.start();
const trioAttacks = new Set();
for (let i = 0; i < 3000 && trio.state !== "clear"; i++) {
  for (const event of trio.tick(1 / 60)) if (event.type === "heroAttacked") trioAttacks.add(event.id);
}
assert.deepEqual(trioAttacks, new Set(["Knight", "Archer", "Mage"]),
  "three reusable heroes attack independently");
assert.equal(trio.state, "clear");

// Every ordinary frame, including both sides of an encounter boundary, must
// preserve each living hero's position and advance at a speed-bounded rate.
for (const members of [[knight], [knight, archer], [knight, archer, mage]]) {
  const continuous = new StageRun(FIRST_STAGE);
  continuous.setSlots(party(members));
  continuous.start();
  let entrances = 0;
  let exits = 0;
  let bossEntrances = 0;
  for (let frame = 0; frame < 6000 && continuous.state !== "clear" &&
      continuous.state !== "failed"; frame++) {
    const previous = new Map(continuous.heroes.map((hero) => [hero.id,
      { x: hero.x, distance: hero.travelDistance, alive: hero.alive }]));
    const previousDistance = continuous.distance;
    const events = continuous.tick(1 / 60);
    for (const hero of continuous.heroes) {
      const old = previous.get(hero.id);
      if (!old.alive || !hero.alive) continue;
      assert.ok(Math.abs(hero.x - old.x) <= hero.moveSpeed / 250 / 60 + 1e-8,
        `${members.length} heroes: ${hero.id} jumped during ${events.map(e => e.type).join(",")}`);
      assert.ok(hero.travelDistance >= old.distance - 1e-8,
        `${hero.id} moved backwards in stage metres`);
    }
    assert.ok(continuous.distance >= previousDistance - 1e-8,
      "background progress must never jump backwards");
    assert.ok(continuous.distance - previousDistance <=
      Math.max(...members.map(hero => hero.moveSpeed)) / 60 + 1e-8,
      "background progress must not jump forward at an encounter");
    for (const event of events) {
      if (event.type === "encounterStarted") {
        entrances++;
        if (event.boss) bossEntrances++;
        assert.ok(continuous.enemies.every((enemy) =>
          enemy.x > Math.max(...continuous.heroes.filter(h => h.alive).map(h => h.x))),
        "new enemies appear ahead of the existing party");
      }
      if (event.type === "encounterCleared") {
        exits++;
        for (const hero of continuous.heroes.filter(h => h.alive)) {
          assert.equal(hero.travelDistance, previous.get(hero.id).distance,
            "finishing an encounter must not reset the hero's travel position");
          if (event.id !== continuous.stage.boss.id)
            assert.equal(hero.state, "running",
              "survivors resume running without an idle state");
        }
      }
    }
  }
  assert.equal(continuous.state, "clear", `${members.length} heroes finish the stage`);
  assert.equal(entrances, FIRST_STAGE.encounters.length + 1);
  assert.equal(exits, entrances);
  assert.equal(bossEntrances, 1);
}

// Live equipment preserves absolute HP, position and attack progress.
const liveGear = new StageRun(travelStage);
liveGear.setSlots(party([knight]));
liveGear.start();
liveGear.tick(1);
const liveKnight = liveGear.heroes[0];
liveKnight.hp = 50;
liveKnight.cooldown = 0.8;
const gearDistance = liveGear.distance;
const gearX = liveKnight.x;
liveGear.setSlots(party([{ ...knight, maxHp: 200, attack: 30, defence: 5,
  attackSpeed: 2, moveSpeed: 140 }]));
assert.equal(liveGear.heroes[0], liveKnight, "equipment does not recreate the fighter");
assert.equal(liveKnight.hp, 50, "MaxHP gain cannot heal");
assert.equal(liveKnight.maxHp, 200);
assert.equal(liveKnight.attack, 30);
assert.equal(liveKnight.defence, 5);
assert.equal(liveKnight.cooldown, 0.4, "speed change preserves cooldown fraction");
assert.equal(liveKnight.x, gearX);
assert.equal(liveGear.distance, gearDistance);
liveGear.tick(1 / 60);
assert.ok(liveGear.distance > gearDistance, "new Move Speed applies on the next tick");
liveGear.setSlots(party([{ ...knight, maxHp: 100 }]));
assert.equal(liveKnight.hp, 50, "MaxHP loss does not heal");
liveGear.setSlots(party([{ ...knight, maxHp: 40 }]));
assert.equal(liveKnight.hp, 40, "MaxHP loss clamps current HP");

const liveStage = { ...formationStage, id: "live-formation",
  boss: { ...formationStage.boss, enemies: [{ ...formationStage.boss.enemies[0],
    maxHp: 10000, attack: 0, attackRange: 0.1 }] } };
const liveParty = new StageRun(liveStage);
liveParty.setSlots(party([knight]));
liveParty.start();
while (liveParty.state === "running") liveParty.tick(1 / 60);
const encounterDistance = liveParty.distance;
const encounterSeconds = liveParty.elapsedSeconds;
liveParty.setSlots(party([knight, archer]));
const joined = liveParty.heroes.find((hero) => hero.id === "Archer");
assert.ok(joined?.alive && joined.hp === joined.maxHp);
assert.equal(liveParty.state, "boss");
assert.equal(liveParty.distance, encounterDistance);
assert.equal(liveParty.elapsedSeconds, encounterSeconds);
assert.ok(joined.x <= liveParty.heroes[0].x, "new hero enters behind the party");
const combatKnight = liveParty.heroes[0];
combatKnight.x = 0.6;
combatKnight.cooldown = 0;
const enemyHpBeforeGear = liveParty.enemies[0].hp;
liveParty.setSlots(party([{ ...knight, attack: 100 }, archer]));
liveParty.tick(1 / 60);
assert.equal(liveParty.enemies[0].hp, enemyHpBeforeGear,
  "Knight impact follows the sword wind-up");
for (let i = 0; i < 60 && liveParty.enemies[0].hp === enemyHpBeforeGear; i++)
  liveParty.tick(1 / 60);
assert.equal(enemyHpBeforeGear - liveParty.enemies[0].hp, 100,
  "the next attack uses live equipment-derived Attack");
let archerAttacked = false;
for (let i = 0; i < 300 && !archerAttacked; i++)
  archerAttacked = liveParty.tick(1 / 60).some((event) => event.type === "heroAttacked" && event.id === "Archer");
assert.ok(archerAttacked, "new hero joins the current encounter");
joined.hp = 30;
const benchedCooldown = joined.cooldown;
liveParty.setSlots(party([knight]));
assert.equal(liveParty.runHeroStates.get("Archer"), joined);
assert.equal(joined.active, false);
liveParty.setSlots(party([knight, { ...archer, maxHp: 200 }]));
assert.equal(liveParty.heroes[1], joined);
assert.equal(joined.hp, 30, "benched equipment cannot heal on re-entry");
assert.equal(joined.maxHp, 200);
assert.equal(joined.x, Math.max(0.08, combatKnight.x - 0.06),
  "living bench return enters near the current party");
assert.ok(joined.cooldown <= benchedCooldown);

// The enemy kills Archer in a real combat tick. Bench/re-add cannot revive him.
const lethalStage = { ...formationStage, id: "dead-reentry",
  boss: { ...formationStage.boss, enemies: [{ ...formationStage.boss.enemies[0],
    maxHp: 10000, attack: 999, attackSpeed: 0.1, attackRange: 1 }] } };
const lethal = new StageRun(lethalStage);
lethal.setSlots(party([knight, archer]));
lethal.start();
while (lethal.state === "running") lethal.tick(1 / 60);
const deadArcher = lethal.heroes[1];
deadArcher.x = 0.67;
let deathEvents = lethal.tick(1 / 60);
assert.ok(deathEvents.some((event) => event.type === "enemyAttackStarted"));
assert.equal(deadArcher.hp, deadArcher.maxHp, "enemy damage waits for its attack contact");
for (let i = 0; i < 60 && deadArcher.alive; i++)
  deathEvents = lethal.tick(1 / 60);
assert.ok(deathEvents.some((event) => event.type === "heroDied" && event.id === "Archer"));
assert.equal(deadArcher.hp, 0);
assert.equal(deadArcher.alive, false);
lethal.setSlots(party([knight]));
lethal.setSlots(party([knight, { ...archer, maxHp: 200 }]));
assert.equal(lethal.heroes[1], deadArcher);
assert.equal(deadArcher.hp, 0);
assert.equal(deadArcher.alive, false);
assert.equal(deadArcher.maxHp, 200, "new MaxHP cannot revive a dead bench hero");
const deadX = deadArcher.x;
const afterReadd = lethal.tick(1 / 60);
assert.equal(deadArcher.x, deadX);
assert.ok(!afterReadd.some((event) => event.type === "heroAttacked" && event.id === "Archer"));
const knightHpBeforeDefence = lethal.heroes[0].hp;
lethal.setSlots(party([{ ...knight, defence: 998 }, { ...archer, maxHp: 200 }]));
lethal.enemies[0].cooldown = 0;
lethal.tick(1 / 60);
for (let i = 0; i < 60 && lethal.heroes[0].hp === knightHpBeforeDefence; i++)
  lethal.tick(1 / 60);
assert.equal(lethal.heroes[0].hp, knightHpBeforeDefence - 1,
  "next incoming hit uses live equipment-derived Defence");
assert.equal(lethal.retry(), true);
assert.notEqual(lethal.heroes[1], deadArcher, "new run creates fresh hero state");
assert.equal(lethal.heroes[1].hp, lethal.heroes[1].maxHp);
assert.equal(lethal.heroes[1].alive, true);

const committedDefeat = new StageRun(lethalStage);
committedDefeat.setSlots(party([knight]));
committedDefeat.start();
while (committedDefeat.state === "running") committedDefeat.tick(1 / 60);
for (let i = 0; i < 90 && committedDefeat.state !== "failed"; i++)
  committedDefeat.tick(1 / 60);
assert.equal(committedDefeat.state, "failed");
committedDefeat.setSlots(party([knight, archer]));
assert.equal(committedDefeat.state, "failed", "formation cannot cancel a committed defeat");
assert.equal(committedDefeat.heroes.length, 1, "failed run cannot spawn a new hero");
assert.deepEqual(committedDefeat.tick(1 / 60), []);
assert.equal(committedDefeat.retry(), true);
assert.equal(committedDefeat.heroes[1].hp, committedDefeat.heroes[1].maxHp);

console.log("Formation, live equipment/formation, HP preservation, dead re-entry, continuous encounters and retry passed");
