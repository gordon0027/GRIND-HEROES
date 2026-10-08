// Pure payout math for the daily GH reward. Amounts are strings of the
// smallest token unit so large on-chain balances never pass through a JS float.
// The publisher supplies the starting budget; CloudCode stores its remainder.

function ghDivideUnits(value, divisor) {
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(divisor) || divisor < 1)
    throw new Error("invalid_power_reward_amount");
  var quotient = "";
  var carry = 0;
  for (var i = 0; i < value.length; i++) {
    var current = carry * 10 + Number(value[i]);
    var digit = Math.floor(current / divisor);
    carry = current % divisor;
    if (quotient || digit) quotient += String(digit);
  }
  return { quotient: quotient || "0", remainder: carry };
}

function ghMultiplyUnits(value, factor) {
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(factor) || factor < 0)
    throw new Error("invalid_power_reward_amount");
  if (value === "0" || factor === 0) return "0";
  var result = "";
  var carry = 0;
  for (var i = value.length - 1; i >= 0; i--) {
    var current = Number(value[i]) * factor + carry;
    result = String(current % 10) + result;
    carry = Math.floor(current / 10);
  }
  return (carry ? String(carry) : "") + result;
}

function ghCompareUnits(left, right) {
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
}

function ghAddUnits(left, right) {
  if (!/^(0|[1-9][0-9]*)$/.test(left) || !/^(0|[1-9][0-9]*)$/.test(right))
    throw new Error("invalid_power_reward_amount");
  var result = "";
  var carry = 0;
  for (var i = 0; i < Math.max(left.length, right.length) || carry; i++) {
    var a = i < left.length ? Number(left[left.length - 1 - i]) : 0;
    var b = i < right.length ? Number(right[right.length - 1 - i]) : 0;
    var value = a + b + carry;
    result = String(value % 10) + result;
    carry = Math.floor(value / 10);
  }
  return (carry ? String(carry) : "") + result;
}

function ghSubtractUnits(value, amount) {
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !/^(0|[1-9][0-9]*)$/.test(amount) ||
      ghCompareUnits(amount, value) > 0)
    throw new Error("invalid_power_reward_amount");
  var result = "";
  var borrow = 0;
  for (var i = 0; i < value.length; i++) {
    var left = Number(value[value.length - 1 - i]) - borrow;
    var right = i < amount.length ? Number(amount[amount.length - 1 - i]) : 0;
    borrow = left < right ? 1 : 0;
    result = String(left + (borrow ? 10 : 0) - right) + result;
  }
  return result.replace(/^0+/, "") || "0";
}

function ghPlanDailyPowerReward(poolUnits, entries) {
  if (typeof poolUnits !== "string" || !/^(0|[1-9][0-9]*)$/.test(poolUnits) ||
      !Array.isArray(entries) || entries.length > 100)
    throw new Error("invalid_power_reward_snapshot");
  var seen = Object.create(null);
  var totalPower = 0;
  var players = entries.map(function (entry) {
    if (!entry || typeof entry.playerId !== "string" || !entry.playerId ||
        !Number.isSafeInteger(entry.power) || entry.power <= 0 || seen[entry.playerId])
      throw new Error("invalid_power_reward_participant");
    seen[entry.playerId] = true;
    totalPower += entry.power;
    if (totalPower > 1000000000000) throw new Error("power_reward_total_power_too_large");
    return { playerId: entry.playerId, power: entry.power, amountUnits: "0" };
  });
  var budgetUnits = ghDivideUnits(poolUnits, 10).quotient;
  var status = !players.length ? "empty_leaderboard" :
    ghCompareUnits(budgetUnits, String(players.length)) < 0 ? "insufficient_budget" : "ready";
  if (status === "ready") {
    var ranked = players.map(function (player, index) {
      var share = ghDivideUnits(ghMultiplyUnits(budgetUnits, player.power), totalPower);
      player.amountUnits = share.quotient;
      return { index: index, remainder: share.remainder };
    });
    var allocated = players.reduce(function (sum, player) {
      return ghAddUnits(sum, player.amountUnits);
    }, "0");
    var dust = Number(ghSubtractUnits(budgetUnits, allocated));
    if (!Number.isSafeInteger(dust) || dust >= players.length)
      throw new Error("invalid_power_reward_rounding");
    ranked.sort(function (a, b) {
      return b.remainder - a.remainder || players[b.index].power - players[a.index].power ||
        players[a.index].playerId.localeCompare(players[b.index].playerId);
    });
    for (var i = 0; i < dust; i++) {
      var winner = players[ranked[i].index];
      winner.amountUnits = ghAddUnits(winner.amountUnits, "1");
    }
    // All ranked players receive at least one whole GH when the budget allows it.
    // Take that minimum from the largest allocation only when a tiny Power
    // would otherwise round to zero.
    players.forEach(function (player) {
      if (player.amountUnits !== "0") return;
      var donor = players.filter(function (other) { return ghCompareUnits(other.amountUnits, "1") > 0; })
        .sort(function (a, b) {
          return ghCompareUnits(b.amountUnits, a.amountUnits) || b.power - a.power ||
            a.playerId.localeCompare(b.playerId);
        })[0];
      if (!donor) throw new Error("invalid_power_reward_minimum");
      donor.amountUnits = ghSubtractUnits(donor.amountUnits, "1");
      player.amountUnits = "1";
    });
  }
  var distributedUnits = status === "ready" ? budgetUnits : "0";
  return {
    poolUnits: poolUnits,
    budgetUnits: budgetUnits,
    status: status,
    totalPower: totalPower,
    distributedUnits: distributedUnits,
    remainingUnits: ghSubtractUnits(poolUnits, distributedUnits),
    allocations: players,
  };
}
