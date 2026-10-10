import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const base = new URL("../src/modules/idle-rpg/server/", import.meta.url);
const source = ["teamPower.js", "powerRewardPlan.js", "powerRewards.js"]
  .map((name) => readFileSync(new URL(name, base), "utf8")).join("\n");

function harness({ powers = [1], pool = "1000", activation = "2026-10-08T00:00:00Z",
  claimsEnabled = true } = {}) {
  let instant = activation;
  const seed = { version: 1, initialPoolUnits: pool,
    recordedAtUtc: "2026-10-08T00:00:00Z", activatedAtUtc: activation,
    payoutsEnabled: true };
  const top = { version: 1, entries: powers.map((power, i) => ({ playerId: `player-${i}`, power })) };
  const records = { grind_team_power_top_v1: { Value: JSON.stringify(top), Version: 1 } };
  const grants = [];
  const logs = [];
  const currency = { CryptoCurrencies: { Main: { Status: "Active", DisplayDecimals: 0 } },
    CryptoIouForScriptsAndAI: false, CryptoRewardsFromDeveloperShare: false };
  let rejectGrant = false;
  let finalizeFailure = false;
  let grantException = false;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return Date.parse(instant); }
  }
  const server = {
    GetTitleCustomData: () => ({ Success: true, Data: { Static: { Private: {
      grind_power_reward_seed_v1: { Value: JSON.stringify(seed), Version: 1 },
    } }, Runtime: { Private: records } } }),
    SetTitleCustomData: (_bucket, key, value, expectedVersion) => {
      const current = records[key];
      if (expectedVersion !== (current?.Version ?? 0))
        return { Success: false, Error: "version_conflict" };
      if (finalizeFailure && key === "grind_power_reward_state_v1" &&
          Object.values(JSON.parse(value).pending).some((account) =>
            account.inFlight === null && account.paidUnits !== "0"))
        return { Success: false, Error: "version_conflict" };
      records[key] = { Value: value, Version: (current?.Version ?? 0) + 1 };
      return { Success: true };
    },
    GetTitleConfig: () => ({ Success: true, Data: { Currency: currency } }),
    ApplyResourceOperation: (operation) => {
      grants.push(operation);
      if (grantException) throw new Error("transport_unknown");
      return rejectGrant ? { Success: false, Error: "pool_empty" } :
        { Success: true, Data: { TransactionID: "platform-transaction" } };
    },
  };
  const log = Object.fromEntries(["Info", "Warning", "Error"].map((level) =>
    [level, (message, data) => logs.push({ level, message, data })]));
  const context = vm.createContext({ server, handlers: {}, log, Date: Clock });
  vm.runInContext(source, context);
  // Unit scenarios exercise the eventual enabled path; the shipped script
  // remains closed until the separate real-token probe succeeds.
  context.GH_POWER_REWARD_CLAIMS_ENABLED = claimsEnabled;
  return {
    context, seed, currency, grants, logs,
    state: () => JSON.parse(records.grind_power_reward_state_v1.Value),
    at: (next) => { instant = next; },
    claim: (player = "player-0") => context.handlers.claimPowerRewards({}, { UserID: player }),
    overview: (player = "player-0") => context.handlers.getPowerRewardOverview({}, { UserID: player }),
    schedule: (next) => context.handlers.reserveDailyPowerRewards({ Trigger: "Schedule",
      ScheduleID: "grind_power_rewards_daily_v1", ScheduledAtUtc: next }),
    setRejectGrant: (value) => { rejectGrant = value; },
    setGrantException: (value) => { grantException = value; },
    setFinalizeFailure: (value) => { finalizeFailure = value; },
    setTop: (nextPowers) => { records.grind_team_power_top_v1.Value = JSON.stringify({
      version: 1, entries: nextPowers.map((power, i) => ({ playerId: `player-${i}`, power })),
    }); },
  };
}

const closed = harness({ claimsEnabled: false });
closed.at("2026-10-08T00:01:00Z");
assert.equal(closed.claim().status, "verification_pending");
assert.equal(closed.grants.length, 0);
assert.equal(closed.overview().status, "available", "eligibility remains visible while grants are gated");

const visits = harness();
visits.at("2026-10-08T00:01:00Z");
const firstOverview = visits.overview();
assert.equal(firstOverview.budgetRemainingUnits, "1000");
assert.equal(firstOverview.dailyBudgetUnits, "100");
assert.equal(firstOverview.dailyShareUnits, "100");
assert.equal(firstOverview.currentWindowUnits, "33");
assert.equal(firstOverview.rank, 1);
assert.equal(firstOverview.status, "available");
assert.equal(visits.claim().amountUnits, "33");
assert.equal(visits.overview().status, "cooldown");
assert.equal(visits.overview().paidTotalUnits, "33");
assert.equal(visits.claim().status, "cooldown");
visits.at("2026-10-08T08:01:00Z");
assert.equal(visits.claim().amountUnits, "33");
visits.at("2026-10-08T16:01:00Z");
assert.equal(visits.claim().amountUnits, "34");
assert.equal(visits.grants.length, 3);
assert.deepEqual(visits.grants.map((grant) => grant.Operation.Grant.Standard.Entries[0].Amount),
  [33, 33, 34]);
assert.equal(visits.state().remainingUnits, "900");
assert.equal(visits.state().pending["player-0"].paidUnits, "100");
assert.equal(visits.logs.find((entry) => entry.message === "power_reward_grant_accepted")?.data.receiptId,
  "platform-transaction");

const absent = harness();
absent.at("2026-10-09T00:05:00Z");
absent.schedule("2026-10-09T00:00:00Z");
assert.equal(absent.state().pending["player-0"].inactiveUnits, "33");
assert.equal(absent.state().remainingUnits, "967");
absent.at("2026-10-12T00:05:00Z");
absent.schedule("2026-10-12T00:00:00Z");
assert.equal(absent.state().pending["player-0"].inactiveUnits, "33",
  "two or more quiet days do not stack extra thirds");
assert.equal(absent.state().remainingUnits, "967");
assert.equal(absent.claim().amountUnits, "65", "one saved third plus today's window");
assert.equal(absent.state().pending["player-0"].inactiveUnits, "0");
assert.equal(absent.state().remainingUnits, "935");

const mixed = harness({ powers: [1, 1] });
mixed.at("2026-10-08T00:01:00Z");
assert.equal(mixed.claim().amountUnits, "16");
mixed.at("2026-10-09T00:01:00Z");
mixed.schedule("2026-10-09T00:00:00Z");
assert.equal(mixed.state().pending["player-0"].inactiveUnits, "0",
  "a player who claimed one window gets no offline bonus for that day");
assert.equal(mixed.state().pending["player-1"].inactiveUnits, "16");
assert.equal(mixed.state().remainingUnits, "968");

const history = harness({ powers: [3, 1] });
history.at("2026-10-08T01:00:00Z");
history.schedule("2026-10-08T00:00:00Z");
history.at("2026-10-09T01:00:00Z");
history.schedule("2026-10-09T00:00:00Z");
assert.equal(history.state().pending["player-0"].inactiveUnits, "25");
assert.equal(history.state().pending["player-1"].inactiveUnits, "8");
history.setTop([1, 3]);
history.at("2026-10-10T01:00:00Z");
history.schedule("2026-10-10T00:00:00Z");
assert.equal(history.state().pending["player-0"].inactiveUnits, "25",
  "later leaderboard changes cannot rewrite a previous day's credit");

const failed = harness();
failed.at("2026-10-08T00:01:00Z");
failed.setRejectGrant(true);
assert.equal(failed.claim().status, "grant_rejected_review_required");
assert.equal(failed.claim().status, "in_flight");
assert.equal(failed.overview().status, "review_required");
assert.equal(failed.overview().paidTotalUnits, "0");
assert.equal(failed.overview().pendingReviewUnits, "33");
assert.equal(failed.grants.length, 1, "uncertain grant stays locked");
assert.equal(failed.grants[0].Operation.Grant.Standard.Entries[0].CurrencyID, "Main");
const failedClaim = failed.state().pending["player-0"].inFlight;
assert.equal(failedClaim.day, "2026-10-08");
assert.equal(failedClaim.window, 1);
assert.equal(failedClaim.amountSource.inactiveUnits, "0");
assert.equal(failedClaim.amountSource.windowUnits, "33");
assert.equal(failedClaim.amountSource.dailyShareUnits, "100");
assert.equal(failed.grants[0].Reason, failedClaim.id);
assert.equal(failed.logs.find((entry) => entry.message === "power_reward_grant_rejected")?.data.error,
  "pool_empty");
assert.ok(failed.logs.every((entry) => !JSON.stringify(entry).includes("player-0")),
  "diagnostic logs omit player identity and raw claim ID");
assert.equal(failed.context.ghRewardGrantError(
  `denied ${failedClaim.id} Bearer abc123secret`, "player-0", failedClaim.id),
  "denied [claim] [credential]");

// Reconciliation needs independent platform evidence. The helper never calls
// ApplyResourceOperation, and only the confirmed outcomes alter a local copy.
const unknown = failed.state();
assert.equal(failed.context.ghRewardReconcileAccount(unknown, "player-0", failedClaim.id,
  "unknown"), false);
assert.equal(unknown.pending["player-0"].inFlight.id, failedClaim.id);
assert.equal(unknown.remainingUnits, "967");

const rejected = failed.state();
assert.equal(failed.context.ghRewardReconcileAccount(rejected, "player-0", failedClaim.id,
  "confirmed_rejected"), true);
assert.equal(rejected.pending["player-0"].inFlight, null);
assert.equal(rejected.pending["player-0"].inactiveUnits, "0");
assert.equal(rejected.pending["player-0"].claimedMask, 0);
assert.equal(rejected.pending["player-0"].lastClaimAtUtc, "");
assert.equal(rejected.pending["player-0"].nonce, 1, "claim IDs are never reused");
assert.equal(rejected.remainingUnits, "1000");
assert.equal(failed.grants.length, 1, "reconciliation does not retry a grant");

const inactiveRejected = harness();
inactiveRejected.at("2026-10-09T00:05:00Z");
inactiveRejected.schedule("2026-10-09T00:00:00Z");
inactiveRejected.setRejectGrant(true);
assert.equal(inactiveRejected.claim().status, "grant_rejected_review_required");
const inactiveState = inactiveRejected.state();
const inactiveClaim = inactiveState.pending["player-0"].inFlight;
assert.equal(inactiveClaim.amountSource.inactiveUnits, "33");
assert.equal(inactiveClaim.amountSource.windowUnits, "32");
inactiveRejected.context.ghRewardReconcileAccount(inactiveState, "player-0", inactiveClaim.id,
  "confirmed_rejected");
assert.equal(inactiveState.pending["player-0"].inactiveUnits, "33");
assert.equal(inactiveState.pending["player-0"].claimedMask, 0);
assert.equal(inactiveState.remainingUnits, "967");

const historical = failed.state();
delete historical.pending["player-0"].inFlight.day;
delete historical.pending["player-0"].inFlight.window;
delete historical.pending["player-0"].inFlight.amountSource;
assert.throws(() => failed.context.ghRewardReconcileAccount(historical, "player-0", failedClaim.id,
  "confirmed_rejected"), /requires_manual_review/);
assert.equal(failed.context.ghRewardReconcileAccount(historical, "player-0", failedClaim.id,
  "confirmed_success"), true, "verified old grants can still be finalized");
assert.equal(historical.pending["player-0"].paidUnits, "33");
assert.equal(historical.pending["player-0"].inFlight, null);

const finalizeFailure = harness();
finalizeFailure.at("2026-10-08T00:01:00Z");
finalizeFailure.setFinalizeFailure(true);
assert.throws(() => finalizeFailure.claim(), /power_reward_claim_finalize_failed/);
assert.equal(finalizeFailure.grants.length, 1, "platform accepted exactly one grant");
assert.equal(finalizeFailure.state().pending["player-0"].inFlight.units, "33");
assert.equal(finalizeFailure.state().pending["player-0"].paidUnits, "0");
assert.equal(finalizeFailure.claim().status, "in_flight", "login cannot double-pay after finalize failure");
assert.ok(finalizeFailure.logs.some((entry) =>
  entry.message === "power_reward_finalize_failed_after_grant"));

const uncertain = harness();
uncertain.at("2026-10-08T00:01:00Z");
uncertain.setGrantException(true);
assert.throws(() => uncertain.claim(), /transport_unknown/);
assert.equal(uncertain.state().pending["player-0"].inFlight.units, "33");
assert.equal(uncertain.claim().status, "in_flight");
assert.ok(uncertain.logs.some((entry) => entry.message === "power_reward_grant_exception"));

const policy = harness();
policy.at("2026-10-08T00:01:00Z");
policy.currency.CryptoIouForScriptsAndAI = true;
assert.throws(() => policy.claim(), /power_reward_backing_policy_changed/);
assert.equal(policy.grants.length, 0);

assert.throws(() => visits.context.handlers.reserveDailyPowerRewards({ Trigger: "Schedule",
  ScheduleID: "grind_power_rewards_daily_v1", ScheduledAtUtc: "2026-10-09T00:00:00Z" },
{ UserID: "player-0" }), /power_reward_schedule_only/);

console.log("Eight-hour GH reward windows, offline cap, and grant locks passed");
