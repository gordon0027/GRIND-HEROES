import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const code = readFileSync(new URL("../src/modules/idle-rpg/server/stageRewards.js", import.meta.url), "utf8");
const clock = (seconds) => ({ InvokedAt: new Date(seconds * 1000).toISOString() });
const stageID = "grind-stage-1-1";

function harness() {
  const records = { Private: {}, ReadOnly: { grind_party_capacity_v2: { Value: "3" } },
    Internal: {}, Public: {} };
  const grants = [];
  const characters = { Knight: { Level: 1 }, Archer: { Level: 1 }, Mage: { Level: 1 } };
  const user = { InventoryV2: { UnstackableItems: {}, VirtualCurrencies: { GOLD: { Amount: 0 } } },
    Character: { Characters: characters } };
  const server = {
    GetUserCustomData: () => ({ Success: true, Data: records }),
    SetUserCustomData: (bucket, key, value) => {
      records[bucket][key] = { Value: value }; return { Success: true };
    },
    BatchSetUserCustomData: (writes) => {
      for (const write of writes) records[write.Bucket][write.KeyID] = { Value: write.Value };
      return { Success: true };
    },
    ReadUserData: () => user,
    ApplyResourceOperation: (request) => { grants.push(request); return { Success: true }; },
    AddQuestProgress: () => ({ Success: true }),
  };
  const vm = { server, handlers: {}, log: { Warning: () => {} }, Date, Math, JSON, Number,
    Object, Array, isFinite, Error };
  runInNewContext(code, vm);
  return {
    vm, records, grants, characters,
    formation(slots, seconds) {
      records.Private.grind_formation_v2 = {
        Value: JSON.stringify({ slots }), UpdatedAt: clock(seconds).InvokedAt,
        Version: Number(records.Private.grind_formation_v2?.Version ?? 0) + 1,
      };
    },
    start(seconds, id = stageID) { return vm.handlers.startStageRun({ stageId: id }, clock(seconds)); },
    sync(runId, seconds) { return vm.handlers.syncStageRunParty({ runId }, clock(seconds)); },
    complete(runId, seconds, id = stageID, extra = {}) {
      return vm.handlers.completeStageRun({ stageId: id, runId, ...extra }, clock(seconds));
    },
    fail(runId, seconds) { return vm.handlers.failStageRun({ runId }, clock(seconds)); },
    xp() { return JSON.parse(records.ReadOnly.grind_hero_xp_v1?.Value ?? "{}"); },
  };
}

function byHero(result, id) { return result.xpEligibility.find((entry) => entry.heroID === id); }
function awarded(result) { return Array.from(result.xpAwards, (entry) => entry.heroID); }

{
  const h = harness();
  h.formation(["Knight", null, null], 0);
  const run = h.start(0);
  const result = h.complete(run.runId, 60);
  assert.equal(result.accepted, true);
  assert.equal(byHero(result, "Knight").activeMs, 60000);
  assert.equal(byHero(result, "Knight").ratio, 1);
  assert.equal(byHero(result, "Knight").xpGranted, 25);
  assert.equal(byHero(result, "Mage").xpGranted, 0);
  assert.deepEqual(awarded(result), ["Knight"]);
  assert.equal(h.xp().Mage, undefined, "benched ownership alone gives zero XP");
}

for (const [joinAt, duration, expected, reason] of [
  [55, 60, false, "participation_ratio"],
  [30, 60, true, "eligible"],
  [50, 60, false, "participation_ratio"],
  [8, 12, false, "minimum_time"],
  [7, 12, true, "eligible"], // exact five-second boundary
  [45, 60, true, "eligible"], // exact 25% boundary
  [45.001, 60, false, "participation_ratio"],
]) {
  const h = harness();
  h.formation(["Knight", null, null], 0);
  const run = h.start(0);
  h.formation(["Knight", "Archer", null], joinAt);
  assert.equal(h.sync(run.runId, joinAt).synced, true);
  const result = h.complete(run.runId, duration);
  assert.equal(byHero(result, "Archer").eligible, expected, `join at ${joinAt}s`);
  assert.equal(byHero(result, "Archer").reason, reason);
  assert.equal(awarded(result).includes("Archer"), expected);
}

for (const [removeAt, expected] of [[20, true], [10, false]]) {
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  h.formation(["Knight", null, null], removeAt);
  h.sync(run.runId, removeAt);
  const result = h.complete(run.runId, 60);
  assert.equal(byHero(result, "Archer").activeMs, removeAt * 1000);
  assert.equal(byHero(result, "Archer").eligible, expected);
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  h.formation(["Knight", null, null], 10); h.sync(run.runId, 10);
  h.formation(["Knight", "Archer", null], 30); h.sync(run.runId, 30);
  h.formation(["Knight", null, null], 40); h.sync(run.runId, 40);
  const result = h.complete(run.runId, 60);
  assert.equal(byHero(result, "Archer").activeMs, 20000,
    "separate intervals accumulate once per hero ID");
  assert.equal(byHero(result, "Archer").eligible, true);
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  const result = h.complete(run.runId, 60, stageID, { deadHeroID: "Knight", heroIdsWhoDeserveXP: ["Mage"] });
  assert.deepEqual(awarded(result), ["Knight", "Archer"],
    "unverified client death and reward lists do not affect server eligibility");
  assert.equal(byHero(result, "Knight").activeMs, 60000,
    "the server has formation time, but no validated death timestamp");
  assert.equal(h.complete(run.runId, 61).reason, "run_not_active");
  assert.equal(h.grants.length, 1);
  assert.equal(h.xp().Knight.xp, 25);
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  assert.equal(h.fail(run.runId, 60).closed, true);
  assert.equal(h.complete(run.runId, 61).reason, "run_not_active");
  assert.deepEqual(h.xp(), {});
  assert.deepEqual(JSON.parse(h.records.Internal.grind_stage_active_v2.Value).participation, {},
    "failed run discards eligibility state");
  assert.equal(h.grants.length, 0);
  const retry = h.start(61);
  const retryClear = h.complete(retry.runId, 121);
  assert.equal(byHero(retryClear, "Archer").activeMs, 60000,
    "automatic retry starts with fresh participation time");
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const old = h.start(0);
  h.records.ReadOnly.grind_stage_progress_v2 = {
    Value: JSON.stringify({ highestUnlocked: 2, completed: {}, bestSeconds: {} }),
  };
  const next = h.start(30, "grind-stage-1-2"); // switching stages replaces the active marker
  assert.equal(h.complete(old.runId, 60).reason, "run_not_active");
  assert.equal(h.complete(next.runId, 90, "grind-stage-1-2").accepted, true);
  assert.equal(h.xp().Archer.xp, 30, "only the new stage run grants XP");
  assert.equal(h.grants.length, 1);
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const first = h.start(0);
  assert.deepEqual(awarded(h.complete(first.runId, 60)), ["Knight", "Archer"]);
  h.formation(["Knight", null, null], 61);
  const second = h.start(61);
  const secondResult = h.complete(second.runId, 121);
  assert.equal(byHero(secondResult, "Archer").activeMs, 0,
    "participation does not leak into the next farming iteration");
  assert.deepEqual(awarded(secondResult), ["Knight"]);
  assert.equal(h.xp().Archer.xp, 25);
  assert.equal(h.xp().Knight.level, 2);
  assert.equal(h.grants.length, 2);
}

{
  const h = harness();
  delete h.characters.Archer;
  h.formation(["Knight", null, null], 0);
  const run = h.start(0);
  h.characters.Archer = { Level: 1 }; // bought mid-run, still on the bench
  const result = h.complete(run.runId, 60);
  assert.equal(byHero(result, "Archer").eligible, false);
  assert.equal(h.xp().Archer, undefined);
}

{
  const h = harness();
  delete h.characters.Archer;
  h.formation(["Knight", null, null], 0);
  const run = h.start(0);
  h.characters.Archer = { Level: 1 };
  h.formation(["Knight", "Archer", null], 10);
  h.sync(run.runId, 10);
  const result = h.complete(run.runId, 60);
  assert.equal(byHero(result, "Archer").activeMs, 50000);
  assert.equal(byHero(result, "Archer").eligible, true,
    "a recruited hero earns XP only after joining an unlocked active slot");
}

{
  const h = harness();
  h.records.ReadOnly.grind_party_capacity_v2.Value = "1";
  h.formation(["Knight", "Archer", "Mage"], 0);
  const run = h.start(0);
  const result = h.complete(run.runId, 60);
  assert.deepEqual(awarded(result), ["Knight"],
    "client-writable formation cannot earn XP through locked slots");
  assert.equal(byHero(result, "Archer").activeMs, 0);
  assert.equal(byHero(result, "Mage").activeMs, 0);
}

{
  const h = harness();
  delete h.characters.Archer;
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  const result = h.complete(run.runId, 60);
  assert.deepEqual(awarded(result), ["Knight"],
    "unowned hero in a client-writable formation cannot earn XP");
  assert.equal(byHero(result, "Archer"), undefined);
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  h.formation(["Knight", null, null], 1);
  h.sync(run.runId, 59); // delayed sync must honor the trusted formation write time
  const result = h.complete(run.runId, 60);
  assert.equal(byHero(result, "Archer").activeMs, 1000);
  assert.equal(byHero(result, "Archer").eligible, false);
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  h.formation(["Knight", null, null], 10);
  h.formation(["Knight", "Archer", null], 50);
  h.sync(run.runId, 55);
  const result = h.complete(run.runId, 60);
  assert.equal(byHero(result, "Archer").activeMs, 5000);
  assert.deepEqual(awarded(result), [],
    "missed formation versions cannot claim an unknown interval as participation");
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  const run = h.start(0);
  h.formation(["Knight", null, null], 10);
  h.formation(["Knight", "Archer", null], 50);
  const result = h.complete(run.runId, 60); // no sync, but final slots match
  assert.deepEqual(awarded(result), [],
    "completion checks formation versions even when final slots look unchanged");
}

{
  const h = harness();
  h.formation(["Knight", "Archer", null], 0);
  delete h.records.Private.grind_formation_v2.Version;
  const run = h.start(0);
  h.formation(["Knight", null, null], 10);
  h.formation(["Knight", "Archer", null], 50);
  delete h.records.Private.grind_formation_v2.Version;
  h.sync(run.runId, 55);
  const result = h.complete(run.runId, 60);
  assert.deepEqual(awarded(result), [],
    "without server record versions, changed UpdatedAt makes the unknown gap fail closed");
}

console.log("Hero XP eligibility: 25%/5s, joins, removals, repeated intervals, death fallback, duplicates, failures, switches and farming passed");
