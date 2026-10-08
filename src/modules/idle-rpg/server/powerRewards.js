// Protected, Power-weighted GH accrual. The first request after a UTC boundary
// closes old days before Team Power can change, so quiet days are reconstructed.
var GH_POWER_REWARD_SEED_KEY = "grind_power_reward_seed_v1";
var GH_POWER_REWARD_STATE_KEY = "grind_power_reward_state_v1";
var GH_POWER_REWARD_SCHEDULE_ID = "grind_power_rewards_daily_v1";
var GH_POWER_REWARD_MAX_CALL_UNITS = 9007199254740991;
var GH_POWER_REWARD_DAY_MS = 86400000;
var GH_POWER_REWARD_COOLDOWN_MS = 28800000;

function ghRewardTitleData() {
  var read = server.GetTitleCustomData();
  if (!read.Success) throw new Error("power_reward_title_read_failed: " + read.Error);
  return read.Data || {};
}

function ghRewardSeed(data) {
  var record = data.Static && data.Static.Private && data.Static.Private[GH_POWER_REWARD_SEED_KEY];
  if (!record || !record.Value) return null;
  var seed = JSON.parse(record.Value);
  if (!seed || seed.version !== 1 || !/^(0|[1-9][0-9]*)$/.test(seed.initialPoolUnits) ||
      !seed.recordedAtUtc || !seed.activatedAtUtc ||
      isNaN(Date.parse(seed.activatedAtUtc))) throw new Error("power_reward_seed_invalid");
  return seed;
}

function ghRewardRecord(data) {
  return data.Runtime && data.Runtime.Private && data.Runtime.Private[GH_POWER_REWARD_STATE_KEY] || null;
}

function ghRewardState(record, seed) {
  if (!record) return { version: 2, seedRecordedAtUtc: seed.recordedAtUtc,
    remainingUnits: seed.initialPoolUnits, day: "", snapshot: null, pending: {}, lastRun: null };
  var state = JSON.parse(record.Value);
  if (!state || state.version !== 2 || state.seedRecordedAtUtc !== seed.recordedAtUtc ||
      !/^(0|[1-9][0-9]*)$/.test(state.remainingUnits) ||
      typeof state.day !== "string" || !state.pending ||
      typeof state.pending !== "object" || Array.isArray(state.pending))
    throw new Error("power_reward_state_invalid");
  return state;
}

function ghRewardAccount(state, playerID) {
  if (!Object.prototype.hasOwnProperty.call(state.pending, playerID))
    state.pending[playerID] = { inactiveUnits: "0", paidUnits: "0", inFlight: null,
      nonce: 0, claimedMask: 0, lastClaimAtUtc: "" };
  var account = state.pending[playerID];
  if (!account || !/^(0|[1-9][0-9]*)$/.test(account.inactiveUnits) ||
      !Number.isSafeInteger(account.nonce) || account.nonce < 0 ||
      !Number.isSafeInteger(account.claimedMask) || account.claimedMask < 0 ||
      account.claimedMask > 7) throw new Error("power_reward_account_invalid");
  return account;
}

function ghRewardWrite(state, record) {
  return server.SetTitleCustomData("Private", GH_POWER_REWARD_STATE_KEY,
    JSON.stringify(state), record ? Number(record.Version) : 0);
}

function ghRewardDay(value) {
  var date = new Date(value);
  if (!value || isNaN(date.getTime())) throw new Error("power_reward_time_invalid");
  return date.toISOString().slice(0, 10);
}

function ghRewardNextDay(day) {
  return new Date(Date.parse(day + "T00:00:00Z") + GH_POWER_REWARD_DAY_MS)
    .toISOString().slice(0, 10);
}

function ghRewardTop(data) {
  var record = data.Runtime && data.Runtime.Private && data.Runtime.Private[GH_TEAM_TOP_KEY];
  return ghTopRows(record && record.Value ? JSON.parse(record.Value) : null);
}

function ghRewardOpenDay(state, day, top) {
  var plan = ghPlanDailyPowerReward(state.remainingUnits, top);
  state.day = day;
  state.snapshot = { day: day, status: plan.status, budgetUnits: plan.budgetUnits,
    shares: plan.status === "ready" ? plan.allocations : [] };
  Object.keys(state.pending).forEach(function (playerID) {
    state.pending[playerID].claimedMask = 0;
  });
  state.lastRun = { day: day, status: plan.status, playerCount: state.snapshot.shares.length,
    budgetUnits: plan.budgetUnits, remainingUnits: state.remainingUnits };
}

function ghRewardSlotUnits(share, slot) {
  var divided = ghDivideUnits(share, 3);
  // With 100 GH, the three windows are 33, 33, 34; offline credit is 33.
  return slot === 2 ? ghAddUnits(divided.quotient, String(divided.remainder)) : divided.quotient;
}

function ghRewardCloseDay(state) {
  if (!state.snapshot) return;
  state.snapshot.shares.forEach(function (entry) {
    var account = ghRewardAccount(state, entry.playerId);
    if (account.claimedMask !== 0 || account.inactiveUnits !== "0") return;
    var units = ghRewardSlotUnits(entry.amountUnits, 0);
    if (units === "0") return;
    state.remainingUnits = ghSubtractUnits(state.remainingUnits, units);
    account.inactiveUnits = units;
  });
}

function ghRewardCatchUp(instant) {
  var today = ghRewardDay(instant);
  for (var attempt = 0; attempt < 6; attempt++) {
    var data = ghRewardTitleData();
    var seed = ghRewardSeed(data);
    if (!seed || seed.payoutsEnabled !== true) return { day: today, status: "disabled" };
    var activationDay = ghRewardDay(seed.activatedAtUtc);
    if (today < activationDay) return { day: today, status: "not_started" };
    var record = ghRewardRecord(data);
    var state = ghRewardState(record, seed);
    if (state.day && today <= state.day)
      return { day: state.day, status: "already_processed" };
    var top = ghRewardTop(data);
    if (!state.day) ghRewardOpenDay(state, activationDay, top);
    var crossed = 0;
    while (state.day < today) {
      ghRewardCloseDay(state);
      var next = ghRewardNextDay(state.day);
      // After one wholly quiet day, every absent player's single fallback
      // credit is already capped. Later quiet days cannot add more.
      if (crossed >= 1 && next < today) next = today;
      ghRewardOpenDay(state, next, top);
      crossed++;
    }
    var write = ghRewardWrite(state, record);
    if (write.Success) return state.lastRun;
    if (attempt === 5) throw new Error("power_reward_catchup_cas_failed: " + write.Error);
  }
  throw new Error("power_reward_catchup_cas_exhausted");
}

handlers.reserveDailyPowerRewards = function (args, context) {
  if (!args || args.Trigger !== "Schedule" ||
      args.ScheduleID !== GH_POWER_REWARD_SCHEDULE_ID || context && context.UserID)
    throw new Error("power_reward_schedule_only");
  return ghRewardCatchUp(args.ScheduledAtUtc);
};

function ghRewardCurrencyReady() {
  var read = server.GetTitleConfig("Currency");
  if (!read || read.Success === false)
    throw new Error("power_reward_currency_config_unavailable");
  var root = read.Data || read;
  var currency = root.Currency || root.CurrencyDefinitions || root;
  var main = currency.CryptoCurrencies && currency.CryptoCurrencies.Main;
  if (!main || main.Status !== "Active" || main.DisplayDecimals !== 0 ||
      currency.CryptoIouForScriptsAndAI !== false ||
      currency.CryptoRewardsFromDeveloperShare !== false)
    throw new Error("power_reward_backing_policy_changed");
}

function ghRewardFinalizeClaim(playerID, claimID) {
  for (var attempt = 0; attempt < 6; attempt++) {
    var data = ghRewardTitleData();
    var record = ghRewardRecord(data);
    if (!record) throw new Error("power_reward_claim_state_missing");
    var state = ghRewardState(record, ghRewardSeed(data));
    var account = ghRewardAccount(state, playerID);
    if (!account.inFlight || account.inFlight.id !== claimID)
      throw new Error("power_reward_claim_reservation_missing");
    var amount = account.inFlight.units;
    account.inFlight = null;
    account.paidUnits = ghAddUnits(account.paidUnits, amount);
    var write = ghRewardWrite(state, record);
    if (write.Success) return;
    if (attempt === 5) throw new Error("power_reward_claim_finalize_failed: " + write.Error);
  }
}

function ghClaimPowerReward(context, now) {
  if (!context || !context.UserID) throw new Error("power_reward_player_only");
  var playerID = context.UserID;
  var nowMs = Date.parse(now);
  var slot = Math.floor(new Date(now).getUTCHours() / 8);
  var reservation = null;
  for (var attempt = 0; attempt < 6; attempt++) {
    var data = ghRewardTitleData();
    var seed = ghRewardSeed(data);
    if (!seed || seed.payoutsEnabled !== true) return { status: "disabled" };
    var record = ghRewardRecord(data);
    if (!record) return { status: "not_started" };
    var state = ghRewardState(record, seed);
    if (state.day !== ghRewardDay(now)) return { status: "catchup_pending" };
    var account = ghRewardAccount(state, playerID);
    if (account.inFlight) return { status: "in_flight" };
    var lastMs = Date.parse(account.lastClaimAtUtc);
    if (!isNaN(lastMs) && nowMs - lastMs < GH_POWER_REWARD_COOLDOWN_MS)
      return { status: "cooldown" };
    var share = state.snapshot && state.snapshot.shares.filter(function (entry) {
      return entry.playerId === playerID;
    })[0];
    var slotUnits = share && !(account.claimedMask & (1 << slot))
      ? ghRewardSlotUnits(share.amountUnits, slot) : "0";
    var units = ghAddUnits(account.inactiveUnits, slotUnits);
    if (units === "0") return { status: "nothing_owed" };
    if (ghCompareUnits(units, String(GH_POWER_REWARD_MAX_CALL_UNITS)) > 0)
      throw new Error("power_reward_claim_too_large");
    ghRewardCurrencyReady();
    var claimID = "grind_power_reward_v2:" + playerID + ":" + (account.nonce + 1);
    account.nonce++;
    account.inactiveUnits = "0";
    account.lastClaimAtUtc = now;
    if (slotUnits !== "0") {
      account.claimedMask |= 1 << slot;
      state.remainingUnits = ghSubtractUnits(state.remainingUnits, slotUnits);
    }
    account.inFlight = { id: claimID, units: units, startedAtUtc: now };
    var write = ghRewardWrite(state, record);
    if (write.Success) { reservation = account.inFlight; break; }
    if (attempt === 5) throw new Error("power_reward_claim_cas_failed: " + write.Error);
  }
  if (!reservation) throw new Error("power_reward_claim_not_reserved");
  var grant = server.ApplyResourceOperation({ Reason: reservation.id,
    Operation: { Grant: { Standard: { Entries: [
      { Type: "CryptoCurrency", CurrencyID: "Main", Amount: Number(reservation.units) },
    ] } } } });
  if (!grant.Success) {
    log.Warning("power_reward_grant_rejected", { player: playerID,
      claim: reservation.id, error: String(grant.Error || "unknown") });
    return { status: "grant_rejected_review_required" };
  }
  ghRewardFinalizeClaim(playerID, reservation.id);
  return { status: "granted", amountUnits: reservation.units };
}

handlers.claimPowerRewards = function (_args, context) {
  if (!context || !context.UserID) throw new Error("power_reward_player_only");
  var now = new Date().toISOString();
  ghRewardCatchUp(now);
  return ghClaimPowerReward(context, now);
};

handlers.getPowerRewardOverview = function (_args, context) {
  if (!context || !context.UserID) throw new Error("power_reward_player_only");
  var now = new Date().toISOString();
  ghRewardCatchUp(now);
  var data = ghRewardTitleData();
  var seed = ghRewardSeed(data);
  var record = seed && ghRewardRecord(data);
  var top = ghRewardTop(data);
  var rank = 0;
  for (var i = 0; i < top.length; i++) {
    if (top[i].playerId === context.UserID) { rank = i + 1; break; }
  }
  var row = rank ? top[rank - 1] : null;
  var state = seed && ghRewardState(record, seed);
  var account = state && ghRewardAccount(state, context.UserID);
  var snapshot = state && state.snapshot;
  var share = snapshot && snapshot.shares.filter(function (entry) {
    return entry.playerId === context.UserID;
  })[0];
  var slot = Math.floor(new Date(now).getUTCHours() / 8);
  var windowUnits = share && account && !(account.claimedMask & (1 << slot))
    ? ghRewardSlotUnits(share.amountUnits, slot) : "0";
  var cooldownUntil = account && account.lastClaimAtUtc
    ? new Date(Date.parse(account.lastClaimAtUtc) + GH_POWER_REWARD_COOLDOWN_MS).toISOString() : null;
  var onCooldown = cooldownUntil && Date.parse(cooldownUntil) > Date.parse(now);
  var status = !seed || seed.payoutsEnabled !== true ? "disabled" :
    !snapshot ? "not_started" : account.inFlight ? "review_required" :
    snapshot.status !== "ready" ? snapshot.status :
    onCooldown ? "cooldown" :
    windowUnits === "0" && account.inactiveUnits === "0" ? "nothing_owed" : "available";
  return {
    day: snapshot ? snapshot.day : ghRewardDay(now),
    status: status,
    budgetRemainingUnits: state ? state.remainingUnits : null,
    dailyBudgetUnits: snapshot ? snapshot.budgetUnits : "0",
    participantCount: snapshot ? snapshot.shares.length : 0,
    rank: rank || null,
    power: row ? row.power : 0,
    dailyShareUnits: share ? share.amountUnits : "0",
    currentWindowUnits: windowUnits,
    inactiveCreditUnits: account ? account.inactiveUnits : "0",
    pendingReviewUnits: account && account.inFlight ? account.inFlight.units : "0",
    paidTotalUnits: account ? account.paidUnits : "0",
    claimedWindow: !!(account && (account.claimedMask & (1 << slot))),
    cooldownUntilUtc: onCooldown ? cooldownUntil : null,
    window: slot + 1,
    nextWindowAtUtc: new Date(Date.parse(ghRewardDay(now) + "T00:00:00Z") +
      (slot + 1) * GH_POWER_REWARD_COOLDOWN_MS).toISOString(),
    updatedAtUtc: now,
  };
};
