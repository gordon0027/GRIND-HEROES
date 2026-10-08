import assert from "node:assert/strict";
import { createServer } from "vite";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { parseStageProgress, recordStageClear } from "../src/modules/idle-rpg/game/stageProgress.ts";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { IdleSession } = await server.ssrLoadModule("/src/modules/idle-rpg/game/session.ts");
  const stageID = (index) => STAGE_CATALOG[index].id;
  const clearedThrough = (last) => {
    let progress = parseStageProgress(null);
    for (let i = 0; i <= last; i++) progress = recordStageClear(progress, stageID(i), 40);
    return progress;
  };
  const makeSession = (stageIndex, state, progress, loop = true) => {
    const session = Object.create(IdleSession.prototype);
    const counters = { completions: 0, failures: 0, starts: 0, inventoryReads: 0 };
    session.run = { stage: STAGE_CATALOG[stageIndex], state, bestClearSeconds: null,
      tick: () => [{ type: state === "clear" ? "stageCleared" : "stageFailed" }] };
    session.stageProgress = progress;
    session.serverRunId = `run-${stageIndex}`;
    session.previewCapacity = null;
    session.autoFlowEnabled = true;
    session.loopEnabled = loop;
    session.autoProgressEnabled = true;
    session.pendingContinuationID = null;
    session.terminalRun = null;
    session.failureClose = null;
    session.autoAdvanceTimer = null;
    session.runGeneration = 0;
    session.hudClock = 0;
    session.lootPending = false;
    session.lootBusy = false;
    session.lootItems = [];
    session.managementWrites = new Set();
    session.heroProgressMap = {};
    session.stagePartyDirty = false;
    session.client = { user: { getUserInventory: async () => {
      counters.inventoryReads++;
      return { ok: true };
    } } };
    session.stageService = {
      complete: async () => {
        counters.completions++;
        return { progress: recordStageClear(progress, stageID(stageIndex), 40),
          serverSeconds: 40, rewards: { gold: 30 }, xpAwards: [], heroProgress: {} };
      },
      fail: async () => { counters.failures++; },
      loadProgress: async () => progress,
    };
    session.refreshHero = () => {};
    session.syncParty = () => {};
    session.changed = () => {};
    session.saveStagePreferences = () => {};
    session.startRun = async () => { counters.starts++; return true; };
    return { session, counters };
  };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const clear = makeSession(3, "clear", clearedThrough(2));
  clear.session.tickRun(1 / 60);
  clear.session.tickRun(1 / 60); // Replayed result must not send another completion.
  await delay(1000);
  assert.equal(clear.counters.completions, 1, "one result sends one server completion");
  assert.equal(clear.counters.inventoryReads, 1, "one result refreshes rewards once");
  assert.equal(clear.counters.starts, 1, "one result starts one next battle");
  assert.equal(clear.session.run.stage.id, stageID(4));

  const fail = makeSession(5, "failed", clearedThrough(4));
  fail.session.tickRun(1 / 60);
  fail.session.tickRun(1 / 60);
  await delay(1350);
  assert.equal(fail.counters.failures, 1, "one failure closes its server run once");
  assert.equal(fail.counters.starts, 1, "one failure starts one fallback battle");
  assert.equal(fail.session.run.stage.id, stageID(4), "fallback selects the last cleared stage");
  assert.equal(fail.session.autoProgressEnabled, false,
    "defeat disarms automatic advancement while farming the fallback");
  assert.equal(fail.session.nextStageID, stageID(5));
  assert.equal(fail.session.selectStage(fail.session.nextStageID), true,
    "NEXT manually selects the already unlocked failed frontier");
  await delay(20);
  assert.equal(fail.session.run.stage.id, stageID(5));
  assert.equal(fail.counters.starts, 2, "manual NEXT starts only its requested battle");
  assert.equal(fail.session.autoProgressEnabled, true, "manual NEXT re-arms progression");

  const rearm = makeSession(4, "clear", clearedThrough(4));
  rearm.session.autoProgressEnabled = false;
  rearm.session.tickRun(1 / 60);
  await delay(30);
  rearm.session.setAutoProgressEnabled(true);
  await delay(950);
  assert.equal(rearm.session.run.stage.id, stageID(5),
    "Advance can re-arm progression from the last cleared farming stage");
  assert.equal(rearm.counters.starts, 1);

  const stopped = makeSession(3, "clear", clearedThrough(2), false);
  stopped.session.tickRun(1 / 60);
  await delay(950);
  assert.equal(stopped.counters.completions, 1, "Loop OFF still grants the current clear once");
  assert.equal(stopped.counters.starts, 0, "Loop OFF does not start another battle");
  assert.equal(stopped.session.run.stage.id, stageID(3));
  const stoppedFailure = makeSession(5, "failed", clearedThrough(4), false);
  stoppedFailure.session.tickRun(1 / 60);
  await delay(50);
  assert.equal(stoppedFailure.session.run.stage.id, stageID(4),
    "Loop OFF selects the last cleared stage after failure");
  assert.equal(stoppedFailure.session.run.state, "ready");
  assert.equal(stoppedFailure.counters.starts, 0, "Loop OFF does not farm automatically");
  console.log("IdleSession result guards, server settlement, fallback and Loop OFF passed");
} finally {
  await server.close();
}
