import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { makeStage } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";

const hero = (id, hp, attack, defence, speed) => {
  const role = HERO_ARCHETYPES[id];
  return { id, classId: id, level: 1, maxHp: hp, attack, defence, attackSpeed: speed,
    moveSpeed: role.moveSpeed, attackRange: role.attackRange,
    combatType: role.combatType, projectile: role.projectile };
};

const knight = (...stats) => hero("Knight", ...stats);
const archer = (...stats) => hero("Archer", ...stats);
const mage = (...stats) => hero("Mage", ...stats);
const starter = [knight(120, 10, 0, 1)];
const duo = [knight(170, 16, 3, 1.1), archer(100, 13, 1, 1.8)];
const trio = [...duo, mage(100, 24, 1, 0.9)];
const undergeared = [knight(120, 10, 0, 1), archer(90, 8, 0, 1.68), mage(80, 29.7, 0, 0.64)];
export const gearedFor = (chapter, stage) => chapter === 1
  ? stage <= 5 ? [knight(170, 15, 2, 1.1), archer(100, 13, 1, 1.8)] : trio
  : chapter === 2
    ? stage <= 5 ? [knight(250, 25, 7, 1.15), archer(150, 24, 2, 2), mage(145, 32, 2, 1)]
      : [knight(300, 30, 9, 1.2), archer(170, 29, 3, 2), mage(165, 38, 3, 1)]
    : stage <= 5 ? [knight(380, 40, 11, 1.2), archer(210, 38, 5, 2.1), mage(205, 50, 5, 1.1)]
      : [knight(510, 52, 14, 1.25), archer(280, 48, 7, 2.2), mage(260, 62, 7, 1.15)];

export const representativeStages = [[1, 1], [1, 5], [1, 10], [2, 1], [2, 5], [2, 10], [3, 1], [3, 5], [3, 10]];

export function simulate(chapter, stageNumber, party) {
  const stage = makeStage(chapter, stageNumber);
  const run = new StageRun(stage);
  run.setSlots([1, 2, 3].map((index) => ({ index, unlocked: index <= party.length,
    hero: party[index - 1] ?? null })));
  run.start();
  let combatSeconds = 0;
  let bossStarted = null;
  let bossSeconds = null;
  let deaths = 0;
  let damageTaken = 0;
  let encounterSeconds = [];
  let started = null;
  for (let i = 0; i < 4800 && !["clear", "failed"].includes(run.state); i++) {
    const before = new Map(run.heroes.map((member) => [member.id, member.hp]));
    if (run.state === "encounter" || run.state === "boss") combatSeconds += 0.25;
    const events = run.tick(0.25);
    for (const member of run.heroes) damageTaken += Math.max(0, (before.get(member.id) ?? member.hp) - member.hp);
    for (const event of events) {
      if (event.type === "encounterStarted") {
        started = run.elapsedSeconds;
        if (event.boss) bossStarted = started;
      }
      if (event.type === "encounterCleared" && started !== null) encounterSeconds.push(run.elapsedSeconds - started);
      if (event.type === "heroDied") deaths++;
      if ((event.type === "stageCleared" || event.type === "stageFailed") && bossStarted !== null)
        bossSeconds = run.elapsedSeconds - bossStarted;
    }
  }
  return {
    stage: `${chapter}-${stageNumber}`, result: run.state, seconds: Math.round(run.elapsedSeconds),
    combatPercent: Math.round(100 * combatSeconds / Math.max(run.elapsedSeconds, 1)),
    hp: run.heroes.map((member) => Math.round(member.hp)), deaths,
    damageTaken: Math.round(damageTaken), bossSeconds: bossSeconds === null ? null : Math.round(bossSeconds),
    normalSeconds: encounterSeconds.length ? Math.round(encounterSeconds.slice(0, -1).reduce((a, b) => a + b, 0) /
      Math.max(1, encounterSeconds.length - 1)) : null,
    enemies: stage.encounters.reduce((sum, encounter) => sum + encounter.enemies.length, stage.boss.enemies.length),
    maxGroup: Math.max(...stage.encounters.map((encounter) => encounter.enemies.length), stage.boss.enemies.length),
  };
}

if (process.argv[1]?.endsWith("balanceSweep.mjs")) {
  for (const [chapter, stage] of representativeStages) {
    const profiles = { A: starter, B: duo, C: trio, D: undergeared, E: gearedFor(chapter, stage) };
    for (const [profile, party] of Object.entries(profiles))
      console.log(JSON.stringify({ profile, ...simulate(chapter, stage, party) }));
  }
}
