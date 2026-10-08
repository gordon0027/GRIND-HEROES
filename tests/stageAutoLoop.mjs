import assert from "node:assert/strict";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { continuationStageID, highestClearedStageID } from "../src/modules/idle-rpg/game/stageFlow.ts";
import { parseStageProgress, recordStageClear, stageUnlocked } from
  "../src/modules/idle-rpg/game/stageProgress.ts";

const id = (index) => STAGE_CATALOG[index].id;
const clearedThrough = (lastIndex) => {
  let progress = parseStageProgress(null);
  for (let i = 0; i <= lastIndex; i++) progress = recordStageClear(progress, id(i), 40);
  return progress;
};
const finish = (stageID, result, before, advance) => {
  const after = result === "clear" ? recordStageClear(before, stageID, 40) : before;
  return { progress: after, nextRun: continuationStageID(stageID, result, before, after, advance) };
};

let progress = clearedThrough(2); // 1-3 cleared; 1-4 is the server-unlocked frontier.
assert.equal(highestClearedStageID(progress), id(2));
assert.equal(finish(id(2), "clear", progress, false).nextRun, id(2),
  "Advance OFF repeats the selected farm stage after a win");
assert.equal(finish(id(2), "failed", progress, false).nextRun, id(2),
  "Advance OFF repeats the selected farm stage after a loss");

let outcome = finish(id(2), "clear", progress, true);
assert.equal(outcome.nextRun, id(3), "Advance ON starts the unlocked frontier after a farm clear");
outcome = finish(id(3), "clear", progress, true);
assert.equal(outcome.nextRun, id(4), "validated frontier clear unlocks and starts the next stage");
progress = outcome.progress;
outcome = finish(id(4), "clear", progress, true);
assert.equal(outcome.nextRun, id(5), "consecutive victories continue automatic progression");
progress = outcome.progress;

const beforeFailure = JSON.stringify(progress);
outcome = finish(id(5), "failed", progress, true);
assert.equal(outcome.nextRun, id(4), "an uncleared frontier loss falls back one cleared stage");
assert.equal(JSON.stringify(outcome.progress), beforeFailure, "failure cannot change unlocks or rewards");
assert.equal(outcome.progress.completed[id(5)], undefined);
assert.equal(finish(id(4), "clear", progress, false).nextRun, id(4),
  "the fallback stage continues farming with Advance OFF");
assert.equal(finish(id(5), "failed", progress, false).nextRun, id(5),
  "a manually selected frontier with Advance OFF retries the same stage");
assert.equal(finish(id(4), "clear", progress, true).nextRun, id(5),
  "enabling Advance during farming retries the frontier after that clear");

assert.equal(finish(id(0), "failed", parseStageProgress(null), true).nextRun, id(0),
  "the first stage automatically retries when there is no cleared fallback");
assert.equal(finish(id(0), "failed", parseStageProgress(null), false).nextRun, id(0));

const older = finish(id(1), "clear", progress, false);
assert.equal(older.nextRun, id(1), "a manually selected old stage farms indefinitely");
assert.equal(older.progress.highestUnlocked, progress.highestUnlocked);
assert.equal(finish(id(1), "clear", progress, true).nextRun, id(2),
  "explicit Advance ON walks forward from an older selected stage");
assert.equal(stageUnlocked(progress, id(5)), true);

const cap = clearedThrough(STAGE_CATALOG.length - 1);
assert.equal(highestClearedStageID(cap), id(STAGE_CATALOG.length - 1));
assert.equal(finish(id(STAGE_CATALOG.length - 1), "clear", cap, true).nextRun,
  id(STAGE_CATALOG.length - 1), "the last stage remains farmable at the catalog cap");

console.log("Automatic farm, advancement, failure fallback and first-stage retry passed");
