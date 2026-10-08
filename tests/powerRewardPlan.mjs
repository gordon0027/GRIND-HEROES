import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/modules/idle-rpg/server/powerRewardPlan.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const plan = (pool, powers) => context.ghPlanDailyPowerReward(pool,
  powers.map((power, i) => ({ playerId: `player-${i}`, power })));
const amounts = (result) => Array.from(result.allocations, (row) => row.amountUnits);

const equal = plan("1000", Array(10).fill(1));
assert.equal(equal.status, "ready");
assert.equal(equal.budgetUnits, "100");
assert.deepEqual(amounts(equal), Array(10).fill("10"));
assert.equal(equal.distributedUnits, "100");
assert.equal(equal.remainingUnits, "900");

const weighted = plan("1000", [2, 1]);
assert.deepEqual(amounts(weighted), ["67", "33"]);
assert.equal(weighted.remainingUnits, "900");
const tie = plan("1000", [1, 1, 1]);
assert.deepEqual(amounts(tie), ["34", "33", "33"]);

const firstDay = plan("40000", Array(10).fill(1));
assert.equal(firstDay.budgetUnits, "4000");
assert.deepEqual(amounts(firstDay), Array(10).fill("400"));
assert.equal(firstDay.remainingUnits, "36000");
const secondDay = plan(firstDay.remainingUnits, Array(10).fill(1));
assert.deepEqual(amounts(secondDay), Array(10).fill("360"));
assert.equal(secondDay.remainingUnits, "32400");

const minimum = plan("100", [1000, 1, 1]);
assert.equal(minimum.status, "ready");
assert.deepEqual(amounts(minimum), ["8", "1", "1"]);
assert.equal(plan("9", Array(10).fill(1)).status, "insufficient_budget");
assert.equal(plan("9", Array(10).fill(1)).remainingUnits, "9");
assert.equal(plan("1000", []).status, "empty_leaderboard");
assert.equal(plan("1000", []).distributedUnits, "0");

const huge = "1234567890123456789012345678901234567890";
const hundred = plan(huge, Array(100).fill(1));
assert.equal(BigInt(hundred.budgetUnits), BigInt(huge) / 10n);
assert.equal(BigInt(hundred.distributedUnits) + BigInt(hundred.remainingUnits), BigInt(huge));
assert.equal(amounts(hundred).reduce((sum, amount) => sum + BigInt(amount), 0n),
  BigInt(hundred.budgetUnits));
assert.equal(BigInt(amounts(hundred)[0]) - BigInt(amounts(hundred)[99]) <= 1n, true);

assert.throws(() => plan("-1", [1]), /invalid_power_reward_snapshot/);
assert.throws(() => plan("1.5", [1]), /invalid_power_reward_snapshot/);
assert.throws(() => plan("1000", Array(101).fill(1)), /invalid_power_reward_snapshot/);
assert.throws(() => context.ghPlanDailyPowerReward("1000", [
  { playerId: "same", power: 2 }, { playerId: "same", power: 1 },
]), /invalid_power_reward_participant/);
assert.throws(() => plan("1000", [1000000000001]), /power_reward_total_power_too_large/);

console.log("Daily GH Power-weighted reward allocation tests passed");
