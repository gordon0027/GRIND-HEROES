import assert from "node:assert/strict";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { parseStageProgress, recordStageClear, stageUnlocked } from
  "../src/modules/idle-rpg/game/stageProgress.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";
import { chapterAvailable, continuationStageID, farmingStageID } from "../src/modules/idle-rpg/game/stageFlow.ts";
import { makeStage, nextStageID } from "../src/modules/idle-rpg/game/stageCatalog.ts";

assert.equal(STAGE_CATALOG.length, 30);
assert.equal(makeStage(1, 1).length, 4500);
assert.equal(makeStage(3, 10).length, 10150);
assert.equal(nextStageID("grind-stage-1-1"), "grind-stage-1-2");
assert.equal(nextStageID("grind-stage-1-9"), "grind-stage-1-10");
assert.equal(nextStageID("grind-stage-1-10"), "grind-stage-2-1");
assert.equal(continuationStageID("grind-stage-1-7", "clear"), "grind-stage-1-7");
assert.equal(continuationStageID("grind-stage-1-7", "failed"), "grind-stage-1-7");
assert.equal(nextStageID("grind-stage-2-10"), "grind-stage-3-1");
assert.equal(nextStageID("grind-stage-3-10"), null);
assert.equal(makeStage(3, 1).id, "grind-stage-3-1");
for (let i = 0; i < STAGE_CATALOG.length; i++) {
  const stage = STAGE_CATALOG[i];
  assert.equal(stage.unlockRequirement, i ? STAGE_CATALOG[i - 1].id : null);
  assert.equal(stage.boss.distance, stage.length);
  assert.equal(stage.boss.enemies[0].visual,
    stage.chapter === 1 ? "ogreboss" : stage.chapter === 2 ? "orangeOgre" : "zombieOgre");
  assert.equal(stage.environment, stage.chapter === 1 ? "forest" : `act${stage.chapter}`);
  const enemies = stage.encounters.flatMap((encounter) => encounter.enemies);
  assert.equal(stage.encounters.length, 5, `${stage.id} has five readable normal waves`);
  assert.ok(stage.encounters.every((encounter) => encounter.enemies.length <= 3), stage.id);
  assert.ok(stage.boss.enemies.length <= 2, stage.id);
  assert.ok(stage.encounters.every((encounter) =>
    encounter.enemies.filter((enemy) => enemy.combatType === "RANGED").length <= 1), stage.id);
  assert.ok(stage.encounters.every((encounter, index) =>
    encounter.distance < stage.length &&
    encounter.distance > (index ? stage.encounters[index - 1].distance : 0)), stage.id);
  const totalEnemies = enemies.length + stage.boss.enemies.length;
  assert.ok(totalEnemies >= 10 && totalEnemies <= 13, stage.id);
  if (stage.chapter > 1) {
    const prefix = stage.chapter === 2 ? "orange" : "undead";
    assert.ok(enemies.every((enemy) => enemy.visual.startsWith(prefix)), stage.id);
    assert.ok(enemies.some((enemy) => enemy.combatType === "RANGED") === (stage.stage > 1), stage.id);
    assert.ok(stage.encounters.every((encounter) => encounter.enemies.length < 2 ||
      encounter.enemies[0].combatType !== "RANGED"), "mixed waves put a melee enemy first");
  }
  assert.ok(stage.rewards.repeat.gold > 0);
  assert.ok(stage.recommendedPower > 0);
  assert.equal(stage.rewards.repeat.bossChestItemID ?? null, stage.stage % 5 === 0 ? "boss_chest" : null);
  assert.ok(stage.minimumClearSeconds > 0);
  assert.doesNotThrow(() => new StageRun(stage));
  if (i > 0) {
    assert.ok(stage.length > STAGE_CATALOG[i - 1].length);
    assert.ok(stage.boss.enemies[0].maxHp > STAGE_CATALOG[i - 1].boss.enemies[0].maxHp);
    assert.ok(stage.rewards.repeat.gold > STAGE_CATALOG[i - 1].rewards.repeat.gold);
    assert.ok(stage.rewards.repeat.heroXP >= STAGE_CATALOG[i - 1].rewards.repeat.heroXP);
    assert.ok(stage.recommendedPower > STAGE_CATALOG[i - 1].recommendedPower);
  }
}

const empty = parseStageProgress(null);
assert.equal(empty.highestUnlocked, 1);
assert.equal(stageUnlocked(empty, STAGE_CATALOG[0].id), true);
assert.equal(stageUnlocked(empty, STAGE_CATALOG[1].id), false);
assert.equal(recordStageClear(empty, STAGE_CATALOG[1].id, 40), empty,
  "a locked stage cannot be recorded as cleared");
const first = recordStageClear(empty, STAGE_CATALOG[0].id, 40);
assert.equal(farmingStageID("grind-stage-1-1", empty), "grind-stage-1-1");
assert.equal(farmingStageID("grind-stage-1-7", empty), "grind-stage-1-1");
assert.equal(farmingStageID("grind-stage-1-2", first), "grind-stage-1-2");
assert.equal(farmingStageID("grind-stage-1-1", first), "grind-stage-1-1",
  "an unlock does not change the selected farming target");
assert.equal(first.highestUnlocked, 2);
assert.equal(first.completed[STAGE_CATALOG[0].id], 1);
assert.equal(first.bestSeconds[STAGE_CATALOG[0].id], 40);
assert.equal(stageUnlocked(first, STAGE_CATALOG[0].id), true, "cleared stages remain replayable");
assert.equal(stageUnlocked(first, STAGE_CATALOG[1].id), true);
const slower = recordStageClear(first, STAGE_CATALOG[0].id, 45);
assert.equal(slower.bestSeconds[STAGE_CATALOG[0].id], 40);
const faster = recordStageClear(slower, STAGE_CATALOG[0].id, 35);
assert.equal(faster.bestSeconds[STAGE_CATALOG[0].id], 35);
assert.equal(faster.completed[STAGE_CATALOG[0].id], 3);
assert.deepEqual(parseStageProgress(JSON.stringify(faster)), faster,
  "unlocks and best times restore from iDos ReadOnly data");
const legacy = parseStageProgress(JSON.stringify({ highestUnlocked: 2,
  completed: { "grind-stage-1": 3 }, bestSeconds: { "grind-stage-1": 39.4 } }));
assert.equal(legacy.completed["grind-stage-1-1"], 3);
assert.equal(legacy.bestSeconds["grind-stage-1-1"], undefined,
  "a 1000m legacy record is not compared with a 5000m chapter-stage run");
let walking = parseStageProgress(null);
assert.equal(chapterAvailable(2, walking), false, "the second act starts locked");
for (const stage of STAGE_CATALOG.slice(0, 9))
  walking = recordStageClear(walking, stage.id, 50);
assert.equal(chapterAvailable(2, walking), false, "clearing 1-9 does not unlock Act 2");
walking = recordStageClear(walking, STAGE_CATALOG[9].id, 50);
assert.equal(walking.highestUnlocked, 11, "1-10 unlocks 2-1");
assert.equal(stageUnlocked(walking, "grind-stage-2-1"), true);
assert.equal(chapterAvailable(2, walking), true, "clearing 1-10 enables Act 2 navigation");
assert.equal(chapterAvailable(3, walking), false);
for (const stage of STAGE_CATALOG.slice(10, 19))
  walking = recordStageClear(walking, stage.id, 60);
assert.equal(chapterAvailable(3, walking), false, "clearing 2-9 does not unlock Act 3");
walking = recordStageClear(walking, STAGE_CATALOG[19].id, 60);
assert.equal(walking.highestUnlocked, 21);
assert.equal(stageUnlocked(walking, "grind-stage-3-1"), true);
assert.equal(chapterAvailable(3, walking), true);
assert.equal(parseStageProgress(JSON.stringify({ highestUnlocked: 20 })).highestUnlocked, 20,
  "existing Act 2 progress remains unchanged when Act 3 is added");

console.log("Thirty stages, Act 1-3 content, migration and chapter unlocks passed");
