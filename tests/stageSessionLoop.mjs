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
  const makeSession = (stageIndex, state, progress) => {
    const session = Object.create(IdleSession.prototype);
    const counters = { completions: 0, failures: 0, starts: 0, inventoryReads: 0 };
    session.run = { stage: STAGE_CATALOG[stageIndex], state, bestClearSeconds: null,
      tick: () => [{ type: state === "clear" ? "stageCleared" : "stageFailed" }] };
    session.stageProgress = progress;
    session.serverRunId = `run-${stageIndex}`;
    session.previewCapacity = null;
    session.autoFlowEnabled = true;
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
    session.loaded = true;
    session.equipmentReady = true;
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
  assert.equal(clear.counters.starts, 1, "one result starts exactly one next battle");
  assert.equal(clear.session.run.stage.id, stageID(4));

  const farm = makeSession(4, "clear", clearedThrough(4));
  farm.session.autoProgressEnabled = false;
  farm.session.tickRun(1 / 60);
  await delay(950);
  assert.equal(farm.session.run.stage.id, stageID(4), "Advance OFF repeats the farm stage");
  assert.equal(farm.counters.starts, 1);

  const farmFailure = makeSession(4, "failed", clearedThrough(4));
  farmFailure.session.autoProgressEnabled = false;
  farmFailure.session.tickRun(1 / 60);
  await delay(1300);
  assert.equal(farmFailure.session.run.stage.id, stageID(4), "farm loss retries the same stage");
  assert.equal(farmFailure.counters.starts, 1);
  assert.equal(farmFailure.session.autoProgressEnabled, false);

  const fail = makeSession(5, "failed", clearedThrough(4));
  fail.session.tickRun(1 / 60);
  fail.session.tickRun(1 / 60);
  await delay(1300);
  assert.equal(fail.counters.failures, 1, "one failure closes its server run once");
  assert.equal(fail.counters.starts, 1, "one failure starts one fallback battle");
  assert.equal(fail.session.run.stage.id, stageID(4), "fallback selects the last cleared stage");
  assert.equal(fail.session.autoProgressEnabled, false, "frontier loss disarms Advance");

  const first = makeSession(0, "failed", parseStageProgress(null));
  first.session.tickRun(1 / 60);
  await delay(1300);
  assert.equal(first.session.run.stage.id, stageID(0), "first stage loss retries first stage");
  assert.equal(first.counters.starts, 1);

  const rearm = makeSession(4, "clear", clearedThrough(4));
  rearm.session.autoProgressEnabled = false;
  rearm.session.run.state = "running";
  rearm.session.setAutoProgressEnabled(true);
  assert.equal(rearm.counters.starts, 0, "Advance toggle does not interrupt the current battle");
  rearm.session.run.state = "clear";
  rearm.session.tickRun(1 / 60);
  await delay(950);
  assert.equal(rearm.session.run.stage.id, stageID(5), "the next battle advances after a farm clear");
  assert.equal(rearm.counters.starts, 1);

  const oldStage = makeSession(9, "running", clearedThrough(9));
  assert.equal(oldStage.session.selectStage(stageID(3)), true);
  await delay(30);
  assert.equal(oldStage.session.run.stage.id, stageID(3));
  assert.equal(oldStage.session.autoProgressEnabled, false, "manual old stage selection turns Advance OFF");
  assert.equal(oldStage.counters.starts, 1);
  oldStage.session.setAutoProgressEnabled(true);
  assert.equal(oldStage.session.selectStage(stageID(3)), true);
  assert.equal(oldStage.session.autoProgressEnabled, false, "selecting the same stage also means farm it");
  assert.equal(oldStage.counters.starts, 1, "same-stage selection does not restart combat");

  const restored = makeSession(2, "ready", clearedThrough(2));
  restored.session.autoFlowEnabled = false;
  restored.session.serverRunId = null;
  restored.session.collect = async () => {};
  restored.session.activate();
  assert.equal(restored.counters.starts, 1, "restored ready stage starts without START");
  restored.session.suspend();

  console.log("IdleSession automatic battle, fallback, reload and single-start guards passed");
} finally {
  await server.close();
}
