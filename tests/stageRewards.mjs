import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { parseHeroProgress, xpToNext } from "../src/modules/idle-rpg/game/heroXP.ts";

const code = readFileSync(new URL("../src/modules/idle-rpg/server/stageRewards.js", import.meta.url), "utf8");
const records = { Private: {}, ReadOnly: {}, Internal: {}, Public: {} };
const inventory = { InventoryV2: { UnstackableItems: {}, VirtualCurrencies: { GOLD: { Amount: 0 } } },
  Character: { Characters: { Knight: { Level: 1 }, Archer: { Level: 1 }, Mage: { Level: 1 } } } };
const grants = [];
const server = {
  GetUserCustomData: () => ({ Success: true, Data: records }),
  SetUserCustomData: (bucket, key, value) => {
    records[bucket][key] = { Value: value };
    return { Success: true };
  },
  BatchSetUserCustomData: (writes) => {
    for (const write of writes) records[write.Bucket][write.KeyID] = { Value: write.Value };
    return { Success: true };
  },
  ReadUserData: () => inventory,
  ApplyResourceOperation: (request) => {
    grants.push(request);
    const spent = request.Operation.Consume?.Standard?.Entries?.find((entry) => entry.CurrencyID === "GOLD")?.Amount ?? 0;
    if (spent > inventory.InventoryV2.VirtualCurrencies.GOLD.Amount) return { Success: false, Error: "insufficient" };
    inventory.InventoryV2.VirtualCurrencies.GOLD.Amount -= spent;
    inventory.InventoryV2.VirtualCurrencies.GOLD.Amount +=
      request.Operation.Grant?.Standard?.Entries?.find((entry) => entry.CurrencyID === "GOLD")?.Amount ?? 0;
    return { Success: true };
  },
  AddQuestProgress: () => ({ Success: true }),
};
const sandbox = { server, handlers: {}, log: { Warning: () => {} }, Date, Math, JSON, Number, Object, Array, isFinite, Error };
runInNewContext(code, sandbox);
assert.equal(sandbox.GH_STAGES.length, STAGE_CATALOG.length);
for (let i = 0; i < STAGE_CATALOG.length; i++) {
  assert.equal(sandbox.GH_STAGES[i].id, STAGE_CATALOG[i].id);
  assert.equal(sandbox.GH_STAGES[i].gold, STAGE_CATALOG[i].rewards.repeat.gold);
  assert.equal(sandbox.GH_STAGES[i].minSeconds, STAGE_CATALOG[i].minimumClearSeconds);
  assert.equal(sandbox.GH_STAGES[i].heroXP, STAGE_CATALOG[i].rewards.repeat.heroXP);
}
const at = (seconds) => ({ InvokedAt: new Date(seconds * 1000).toISOString() });
const writeFormation = (slots, seconds) => {
  records.Private.grind_formation_v2 = { Value: JSON.stringify({ slots }),
    UpdatedAt: at(seconds).InvokedAt,
    Version: Number(records.Private.grind_formation_v2?.Version ?? 0) + 1 };
};
const start = (stageId, seconds) => sandbox.handlers.startStageRun({ stageId }, at(seconds));
const complete = (stageId, runId, seconds, extra = {}) =>
  sandbox.handlers.completeStageRun({ stageId, runId, ...extra }, at(seconds));
const progress = () => JSON.parse(records.ReadOnly.grind_stage_progress_v2.Value);

assert.equal(start("grind-stage-1-2", 0).reason, "stage_locked");
const first = start("grind-stage-1-1", 0);
assert.equal(first.accepted, true);
assert.equal(complete("grind-stage-1-1", first.runId, 0.1).reason, "implausible_time");
assert.equal(grants.length, 0);
const win = complete("grind-stage-1-1", first.runId, 40, { gold: 999999, itemID: "dragon_blade" });
assert.equal(win.accepted, true);
assert.equal(win.firstClear, true);
assert.equal(progress().highestUnlocked, 2);
assert.equal(progress().bestSeconds["grind-stage-1-1"], 40);
assert.equal(grants.length, 1);
assert.equal(win.xpAwards.length, 1);
assert.equal(win.xpAwards[0].heroID, "Knight");
assert.equal(win.heroProgress.Knight.xp, 25);
assert.deepEqual(Array.from(grants[0].Operation.Grant.Standard.Entries, (entry) => entry.Amount), [20, 1, 1],
  "client payload cannot select reward amounts or items");
assert.equal(complete("grind-stage-1-1", first.runId, 42).reason, "run_not_active");
assert.equal(grants.length, 1, "one run grants only once");
assert.equal(JSON.parse(records.ReadOnly.grind_hero_xp_v1.Value).Knight.xp, 25,
  "duplicate completion cannot award XP twice");

const failed = start("grind-stage-1-2", 45);
assert.equal(sandbox.handlers.failStageRun({ runId: failed.runId }, at(50)).closed, true);
assert.equal(complete("grind-stage-1-2", failed.runId, 60).reason, "run_not_active");
assert.equal(progress().highestUnlocked, 2);
assert.equal(grants.length, 1);

const replay = start("grind-stage-1-1", 70);
assert.equal(complete("grind-stage-1-1", replay.runId, 120).accepted, true);
assert.equal(progress().bestSeconds["grind-stage-1-1"], 40, "slower clear keeps best");
assert.equal(grants[1].Operation.Grant.Standard.Entries.length, 2, "first bonus is not farmable");
const faster = start("grind-stage-1-1", 130);
assert.equal(complete("grind-stage-1-1", faster.runId, 165).accepted, true);
assert.equal(progress().bestSeconds["grind-stage-1-1"], 35, "faster clear replaces best");
assert.equal(new Set([first.runId, replay.runId, faster.runId]).size, 3,
  "three farming iterations each use a fresh server run ID");
assert.equal(progress().completed["grind-stage-1-1"], 3);
assert.equal(grants.length, 3, "each successful iteration grants once");
assert.equal(JSON.parse(records.ReadOnly.grind_hero_xp_v1.Value).Knight.level, 2,
  "overflow from repeated clears raises the hero level");

const changed = start("grind-stage-1-2", 180);
inventory.InventoryV2.UnstackableItems.boots1 = { EquippedSlot: { CharacterID: "Knight", SlotID: "Boots" } };
assert.equal(complete("grind-stage-1-2", changed.runId, 220).reason, "party_changed");
assert.equal(grants.length, 3);
assert.equal(sandbox.handlers.failStageRun({ runId: changed.runId }, at(221)).closed, true);
const abandoned = start("grind-stage-1-1", 222);
assert.equal(sandbox.handlers.failStageRun({ runId: abandoned.runId }, at(223)).closed, true);
const selectedNext = start("grind-stage-1-2", 224);
assert.equal(selectedNext.accepted, true);
assert.equal(complete("grind-stage-1-1", abandoned.runId, 260).reason, "run_not_active",
  "changing the farming target cannot claim an abandoned run");
assert.equal(grants.length, 3);
assert.equal(sandbox.handlers.failStageRun({ runId: selectedNext.runId }, at(225)).closed, true);

assert.equal(JSON.parse(JSON.stringify(progress())).highestUnlocked, 2,
  "progress is serializable for a later login");
records.ReadOnly.grind_stage_progress_v2.Value = JSON.stringify({ ...progress(), highestUnlocked: 5 });
const milestone = start("grind-stage-1-5", 230);
assert.equal(milestone.accepted, true);
const milestoneClear = complete("grind-stage-1-5", milestone.runId, 270);
assert.equal(milestoneClear.accepted, true);
assert.equal(milestoneClear.rewards.bossChestItemID, "boss_chest");
assert.deepEqual(Array.from(grants.at(-1).Operation.Grant.Standard.Entries, (entry) => entry.ItemID ?? entry.CurrencyID),
  ["GOLD", "stage_chest", "boss_chest"], "milestone stage grants both unopened chest items");
const prices = sandbox.handlers.getPartySlotPrices();
assert.equal(prices.slot2, 5000);
assert.equal(prices.slot3, 25000);
assert.equal(sandbox.handlers.unlockPartySlot({ slot: 3 }).reason, "previous_slot_locked");
assert.equal(sandbox.handlers.unlockPartySlot({ slot: 2 }).reason, "not_enough_gold");
inventory.InventoryV2.VirtualCurrencies.GOLD.Amount = 6000;
const beforeSlot = start("grind-stage-1-1", 300);
assert.equal(sandbox.handlers.unlockPartySlot({ slot: 2 }).unlocked, true);
assert.equal(inventory.InventoryV2.VirtualCurrencies.GOLD.Amount, 1000);
assert.equal(records.ReadOnly.grind_party_capacity_v2.Value, "2");
assert.equal(sandbox.handlers.unlockPartySlot({ slot: 2 }).reason, "already_unlocked");
assert.equal(inventory.InventoryV2.VirtualCurrencies.GOLD.Amount, 1000, "duplicate cannot charge");
assert.equal(complete("grind-stage-1-1", beforeSlot.runId, 340).accepted, true,
  "buying a party slot must not invalidate an active run");
inventory.InventoryV2.VirtualCurrencies.GOLD.Amount = 26000;
assert.equal(sandbox.handlers.unlockPartySlot({ slot: 3 }).unlocked, true);
assert.equal(inventory.InventoryV2.VirtualCurrencies.GOLD.Amount, 1000);
assert.equal(records.ReadOnly.grind_party_capacity_v2.Value, "3");
const liveManaged = start("grind-stage-1-1", 400);
inventory.InventoryV2.UnstackableItems.helmet1 = { EquippedSlot: { CharacterID: "Archer", SlotID: "Helmet" } };
writeFormation(["Knight", "Archer", null], 420);
assert.equal(sandbox.handlers.syncStageRunParty({ runId: "wrong" }).reason, "run_not_active");
assert.equal(sandbox.handlers.syncStageRunParty({ runId: liveManaged.runId }, at(420)).synced, true);
assert.equal(complete("grind-stage-1-1", liveManaged.runId, 440).accepted, true,
  "server-authoritative live equipment and formation may complete the same run");
assert.equal(complete("grind-stage-1-1", liveManaged.runId, 441).reason, "run_not_active",
  "same live run remains closed");
assert.equal(sandbox.handlers.syncStageRunParty({ runId: liveManaged.runId }).reason, "run_not_active",
  "closed runs cannot be rewritten");

const xpState = () => JSON.parse(records.ReadOnly.grind_hero_xp_v1.Value);
writeFormation(["Knight", "Archer", null], 500);
const together = start("grind-stage-1-1", 500);
const togetherClear = complete("grind-stage-1-1", together.runId, 540, { deadHeroID: "Archer" });
assert.deepEqual(Array.from(togetherClear.xpAwards, (award) => award.heroID), ["Knight", "Archer"],
  "both active heroes get full XP; dead participants still qualify; benched Mage gets none");
assert.equal(togetherClear.xpAwards[0].amount, 25);
assert.equal(togetherClear.xpAwards[1].amount, 25);
assert.equal(xpState().Mage, undefined);
const archerBefore = xpState().Archer;

writeFormation(["Knight", null, null], 600);
const late = start("grind-stage-1-1", 600);
writeFormation(["Knight", "Archer", null], 638);
assert.equal(sandbox.handlers.syncStageRunParty({ runId: late.runId }, at(638)).synced, true);
const lateClear = complete("grind-stage-1-1", late.runId, 640);
assert.deepEqual(Array.from(lateClear.xpAwards, (award) => award.heroID), ["Knight"],
  "joining two seconds before victory is below the five-second threshold");
assert.deepEqual(xpState().Archer, archerBefore);

const removed = start("grind-stage-1-1", 700);
writeFormation(["Knight", null, null], 720);
assert.equal(sandbox.handlers.syncStageRunParty({ runId: removed.runId }, at(720)).synced, true);
const removedClear = complete("grind-stage-1-1", removed.runId, 740);
assert.deepEqual(Array.from(removedClear.xpAwards, (award) => award.heroID), ["Knight", "Archer"],
  "a hero removed after meaningful participation keeps credit");

writeFormation(["Knight", "Archer", null], 800);
const delayedSync = start("grind-stage-1-1", 800);
writeFormation(["Knight", null, null], 801);
assert.equal(sandbox.handlers.syncStageRunParty({ runId: delayedSync.runId }, at(838)).synced, true);
assert.deepEqual(Array.from(complete("grind-stage-1-1", delayedSync.runId, 840).xpAwards,
  (award) => award.heroID), ["Knight"],
  "server formation write time prevents delayed-sync credit for a removed hero");

records.ReadOnly.grind_hero_xp_v1 = { Value: JSON.stringify({
  ...xpState(), Knight: { level: 1, xp: 49 }, Archer: { level: 3, xp: 109 },
}) };
writeFormation(["Knight", "Archer", null], 900);
records.ReadOnly.grind_stage_progress_v2.Value = JSON.stringify({ ...progress(), highestUnlocked: 20 });
const overflow = start("grind-stage-2-10", 900);
assert.equal(start("grind-stage-3-1", 901).reason, "stage_locked",
  "Act 3 cannot begin before clearing 2-10 on the server");
const overflowClear = complete("grind-stage-2-10", overflow.runId, 950);
assert.equal(overflowClear.accepted, true);
assert.equal(progress().highestUnlocked, 21, "server clear of 2-10 unlocks 3-1");
assert.deepEqual(JSON.parse(JSON.stringify(xpState().Knight)), { level: 3, xp: 39 },
  "one reward may cross two thresholds while preserving overflow");
assert.deepEqual(JSON.parse(JSON.stringify(xpState().Archer)), { level: 4, xp: 119 },
  "heroes use separate XP and Level records that survive a fresh read");
assert.equal(complete("grind-stage-2-10", overflow.runId, 951).reason, "run_not_active");
assert.equal(xpState().Knight.xp, 39, "duplicate completion does not grant Hero XP");
assert.deepEqual(parseHeroProgress(records.ReadOnly.grind_hero_xp_v1.Value).Knight,
  { level: 3, xp: 39 }, "fresh client read restores each hero's progress");
assert.equal(xpToNext(30), 0, "maximum level has no next XP threshold");
const act3Run = start("grind-stage-3-1", 960);
assert.equal(act3Run.accepted, true, "the server recognizes Act 3 after unlock");
const act3Clear = complete("grind-stage-3-1", act3Run.runId, 1000);
assert.equal(act3Clear.accepted, true);
assert.equal(act3Clear.rewards.gold, STAGE_CATALOG[20].rewards.repeat.gold);
assert.equal(progress().highestUnlocked, 22);
console.log("CloudCode lifecycle, live party signature sync, Gold purchases and duplicate protection passed");
