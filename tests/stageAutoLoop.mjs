import assert from "node:assert/strict";
import { STAGE_CATALOG, nextStageID } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { continuationStageID, highestClearedStageID } from "../src/modules/idle-rpg/game/stageFlow.ts";
import { parseStageProgress, recordStageClear, stageUnlocked } from
  "../src/modules/idle-rpg/game/stageProgress.ts";

const id = (index) => STAGE_CATALOG[index].id;
const clearedThrough = (lastIndex) => {
  let progress = parseStageProgress(null);
  for (let i = 0; i <= lastIndex; i++) progress = recordStageClear(progress, id(i), 40);
  return progress;
};
const finish = (stageID, result, before, loop = true) => {
  const after = result === "clear" ? recordStageClear(before, stageID, 40) : before;
  const target = continuationStageID(stageID, result, before, after);
  return { progress: after, target, nextRun: loop ? target : null };
};

let progress = clearedThrough(2); // 1-3 cleared; 1-4 is the server-unlocked frontier.
assert.equal(highestClearedStageID(progress), id(2));
let outcome = finish(id(3), "clear", progress);
assert.equal(outcome.progress.highestUnlocked, 5);
assert.equal(outcome.nextRun, id(4), "a validated frontier clear advances to the newly unlocked stage");
progress = outcome.progress;
outcome = finish(id(4), "clear", progress);
assert.equal(outcome.nextRun, id(5), "consecutive frontier clears keep advancing");
progress = outcome.progress;

const beforeFailure = JSON.stringify(progress);
outcome = finish(id(5), "failed", progress);
assert.equal(outcome.nextRun, id(4), "an uncleared frontier failure falls back to the last clear");
assert.equal(JSON.stringify(outcome.progress), beforeFailure, "failure cannot change unlocks or rewards");
assert.equal(outcome.progress.completed[id(5)], undefined);
progress = outcome.progress;
outcome = finish(id(4), "clear", progress);
assert.equal(outcome.nextRun, id(4), "fallback farming repeats instead of retrying the failed stage");
assert.equal(nextStageID(outcome.nextRun), id(5), "NEXT can retry the already server-unlocked frontier");
assert.equal(stageUnlocked(outcome.progress, id(5)), true);
assert.equal(outcome.progress.highestUnlocked, progress.highestUnlocked,
  "farming an old clear never lowers highest progression");

const old = finish(id(1), "clear", progress);
assert.equal(old.nextRun, id(1), "manually selected older stages loop themselves");
assert.equal(old.progress.highestUnlocked, progress.highestUnlocked);
assert.equal(finish(id(5), "clear", progress, false).nextRun, null,
  "Loop OFF stops after a frontier victory");
assert.equal(finish(id(5), "failed", progress, false).nextRun, null,
  "Loop OFF stops after failure");
assert.equal(finish(id(0), "failed", parseStageProgress(null)).nextRun, null,
  "no cleared stage means the first failed stage waits for a manual retry");

const cap = clearedThrough(STAGE_CATALOG.length - 1);
assert.equal(highestClearedStageID(cap), id(STAGE_CATALOG.length - 1));
assert.equal(finish(id(STAGE_CATALOG.length - 1), "clear", cap).nextRun,
  id(STAGE_CATALOG.length - 1), "the final cleared stage remains farmable");

console.log("Frontier progression, fallback, manual NEXT, old-stage farming and Loop OFF passed");
