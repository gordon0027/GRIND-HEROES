import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const base = new URL("../src/modules/idle-rpg/server/", import.meta.url);
const source = ["teamPower.js", "powerRewardPlan.js", "powerRewards.js"]
  .map((name) => readFileSync(new URL(name, base), "utf8")).join("\n");

function harness({ powers = [1], pool = "1000", activation = "2026-10-08T00:00:00Z" } = {}) {
  let instant = activation;
  const seed = { version: 1, initialPoolUnits: pool,
    recordedAtUtc: "2026-10-08T00:00:00Z", activatedAtUtc: activation,
    payoutsEnabled: true };
  const top = { version: 1, entries: powers.map((power, i) => ({ playerId: `player-${i}`, power })) };
  const records = { grind_team_power_top_v1: { Value: JSON.stringify(top), Version: 1 } };
  const grants = [];
  const currency = { CryptoCurrencies: { Main: { Status: "Active", DisplayDecimals: 0 } },
    CryptoIouForScriptsAndAI: false, CryptoRewardsFromDeveloperShare: false };
  let rejectGrant = false;
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
      records[key] = { Value: value, Version: (current?.Version ?? 0) + 1 };
      return { Success: true };
    },
    GetTitleConfig: () => ({ Success: true, Data: { Currency: currency } }),
    ApplyResourceOperation: (operation) => {
      grants.push(operation);
      return rejectGrant ? { Success: false, Error: "pool_empty" } : { Success: true };
    },
  };
  const context = vm.createContext({ server, handlers: {}, log: { Warning() {} }, Date: Clock });
  vm.runInContext(source, context);
  return {
    context, seed, currency, grants,
    state: () => JSON.parse(records.grind_power_reward_state_v1.Value),
    at: (next) => { instant = next; },
    claim: (player = "player-0") => context.handlers.claimPowerRewards({}, { UserID: player }),
    overview: (player = "player-0") => context.handlers.getPowerRewardOverview({}, { UserID: player }),
    schedule: (next) => context.handlers.reserveDailyPowerRewards({ Trigger: "Schedule",
      ScheduleID: "grind_power_rewards_daily_v1", ScheduledAtUtc: next }),
    setRejectGrant: (value) => { rejectGrant = value; },
    setTop: (nextPowers) => { records.grind_team_power_top_v1.Value = JSON.stringify({
      version: 1, entries: nextPowers.map((power, i) => ({ playerId: `player-${i}`, power })),
    }); },
  };
}

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

const policy = harness();
policy.at("2026-10-08T00:01:00Z");
policy.currency.CryptoIouForScriptsAndAI = true;
assert.throws(() => policy.claim(), /power_reward_backing_policy_changed/);
assert.equal(policy.grants.length, 0);

assert.throws(() => visits.context.handlers.reserveDailyPowerRewards({ Trigger: "Schedule",
  ScheduleID: "grind_power_rewards_daily_v1", ScheduledAtUtc: "2026-10-09T00:00:00Z" },
{ UserID: "player-0" }), /power_reward_schedule_only/);

console.log("Eight-hour GH reward windows, offline cap, and grant locks passed");
