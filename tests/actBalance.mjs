import assert from "node:assert/strict";
import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { makeStage } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";

const source = (id, maxHp, attack, defence, attackSpeed) => {
  const role = HERO_ARCHETYPES[id];
  return { id, classId: id, level: 1, maxHp, attack, defence, attackSpeed,
    moveSpeed: role.moveSpeed, attackRange: role.attackRange,
    combatType: role.combatType, projectile: role.projectile };
};
const profiles = {
  starter: [source("Knight", 120, 10, 0, 1)],
  act2: [source("Knight", 165, 16, 3, 1.1), source("Archer", 110, 15, 1, 1.8),
    source("Mage", 110, 22, 1, 0.9)],
  act3: [source("Knight", 250, 25, 7, 1.15), source("Archer", 150, 24, 2, 2),
    source("Mage", 145, 32, 2, 1)],
  late: [source("Knight", 380, 40, 11, 1.2), source("Archer", 210, 38, 5, 2.1),
    source("Mage", 205, 50, 5, 1.1)],
};
const simulate = (chapter, stage, party) => {
  const run = new StageRun(makeStage(chapter, stage));
  run.setSlots([1, 2, 3].map((index) => ({ index, unlocked: index <= party.length,
    hero: party[index - 1] ?? null })));
  run.start();
  for (let i = 0; i < 1200 * 4 && !["clear", "failed"].includes(run.state); i++) run.tick(0.25);
  return { result: run.state, seconds: Math.round(run.elapsedSeconds),
    living: run.heroes.filter((hero) => hero.alive).length };
};
const outcomes = {
  onboarding: simulate(1, 1, profiles.starter),
  act2: simulate(2, 1, profiles.act2),
  act2Boss: simulate(2, 10, profiles.act3),
  act3: simulate(3, 1, profiles.act3),
  finale: simulate(3, 10, profiles.late),
};
for (const [scenario, outcome] of Object.entries(outcomes)) {
  assert.equal(outcome.result, "clear", `${scenario}: ${JSON.stringify(outcome)}`);
  assert.ok(outcome.seconds > 10 && outcome.seconds < 600,
    `${scenario} should take meaningful time without becoming an HP wall`);
}
console.log("Act balance scenarios", outcomes);
