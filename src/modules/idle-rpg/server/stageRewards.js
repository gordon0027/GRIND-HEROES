// Concatenate this file with grindEquipment.js for the DEV CloudCode revision. No client imports.
// The server owns stage eligibility, clock, first-clear status, and grant amounts.
var GH_STAGES = [];
for (var chapter = 1; chapter <= 3; chapter++) {
  for (var stageNumber = 1; stageNumber <= 10; stageNumber++) {
    var ordinal = (chapter - 1) * 10 + stageNumber - 1;
    GH_STAGES.push({
      id: "grind-stage-" + chapter + "-" + stageNumber,
      minSeconds: 7 + Math.floor(ordinal / 3),
      gold: 30 + ordinal * 8 + (ordinal >= 20 ? 200 : ordinal >= 10 ? 80 : 0) +
        Math.floor(ordinal / 10) * (ordinal % 10) * 10,
      heroXP: 25 + ordinal * 5,
      bossChest: stageNumber % 5 === 0,
      firstItem: ordinal === 0 ? "traveler_boots" : null,
    });
  }
}
var GH_PROGRESS_KEY = "grind_stage_progress_v2";
var GH_ACTIVE_KEY = "grind_stage_active_v2";
var GH_HERO_XP_KEY = "grind_hero_xp_v1";
var GH_HERO_LEVEL_CAP = 30;
var GH_MAX_SECONDS = 1200;
var GH_MIN_HERO_XP_PARTICIPATION_MS = 5000;
var GH_MIN_HERO_XP_PARTICIPATION_RATIO = 0.25;
// Tunable DEV-only party prices. The client reads these through getPartySlotPrices.
var GH_PARTY_SLOT_COSTS = { 2: 50000, 3: 250000 };
var GH_PARTY_CAPACITY_KEY = "grind_party_capacity_v2";

function ghStage(stageId) {
  for (var i = 0; i < GH_STAGES.length; i++)
    if (GH_STAGES[i].id === stageId) return { index: i, config: GH_STAGES[i] };
  return null;
}

function ghReadJson(bucket, key, fallback) {
  var record = bucket && bucket[key];
  if (!record || !record.Value) return fallback;
  try { return JSON.parse(record.Value); } catch (e) { return fallback; }
}

function ghNow(context) {
  var when = new Date(context.InvokedAt).getTime();
  return isFinite(when) ? when : Date.now();
}

function ghProgress(data) {
  var value = ghReadJson(data.ReadOnly, GH_PROGRESS_KEY, null);
  if (!value || typeof value !== "object") value = {};
  var completed = value.completed && typeof value.completed === "object" ? value.completed : {};
  var bestSeconds = value.bestSeconds && typeof value.bestSeconds === "object" ? value.bestSeconds : {};
  // Map the former five flat stage IDs to Chapter 1 without losing DEV player records.
  for (var legacy = 1; legacy <= 5; legacy++) {
    var oldID = "grind-stage-" + legacy;
    var newID = "grind-stage-1-" + legacy;
    if (completed[oldID] && !completed[newID]) completed[newID] = completed[oldID];
    // Old bests remain under their old IDs: the new stages are five times longer.
  }
  return {
    highestUnlocked: Math.max(1, Math.min(GH_STAGES.length,
      Math.floor(Number(value.highestUnlocked) || 1))),
    completed: completed,
    bestSeconds: bestSeconds,
  };
}

function ghEquipmentSignature(data) {
  return ghGrindEquipmentSignature(data);
}

function ghFormationSignature(data) {
  var formation = ghReadJson(data.Private, "grind_formation_v2", { slots: ["Knight", null, null] });
  var slots = formation && Array.isArray(formation.slots) ? formation.slots : ["Knight", null, null];
  return JSON.stringify({ slots: slots.slice(0, 3) });
}

function ghOwnedHeroes() {
  var state = server.ReadUserData(["Character"]);
  var characters = state && state.Character && state.Character.Characters || {};
  // Knight is configured as the default hero and can be playable before its
  // first Character write materializes a model in UserData.
  if (!characters.Knight) characters.Knight = { Level: 1 };
  return characters;
}

function ghServerFormationHeroes(signature, data) {
  var capacity = Math.max(1, Math.min(3, Math.floor(Number(data.ReadOnly &&
    data.ReadOnly[GH_PARTY_CAPACITY_KEY] && data.ReadOnly[GH_PARTY_CAPACITY_KEY].Value || 1))));
  var owned = ghOwnedHeroes();
  try {
    var slots = JSON.parse(signature).slots;
    if (!Array.isArray(slots)) return [];
    return slots.slice(0, capacity).filter(function (id, index) {
      return (id === "Knight" || id === "Archer" || id === "Mage") &&
        slots.indexOf(id) === index && owned[id] && Number(owned[id].Level) > 0;
    });
  } catch (e) { return []; }
}

function ghFormationVersion(data) {
  var record = data.Private && data.Private.grind_formation_v2;
  var version = record && Number(record.Version);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

function ghFormationUpdatedAt(data) {
  var record = data.Private && data.Private.grind_formation_v2;
  return record && typeof record.UpdatedAt === "string" ? record.UpdatedAt : null;
}

function ghAccrueParticipation(active, now) {
  var since = Number(active.partyAt || active.startedAt);
  var until = Math.max(since, now);
  var elapsed = until - since;
  if (!active.participation) active.participation = {};
  (active.formationHeroes || []).forEach(function (id) {
    active.participation[id] = Number(active.participation[id] || 0) + elapsed;
  });
  active.partyAt = until;
}

function ghSyncParticipation(active, data, now) {
  var next = ghFormationSignature(data);
  var nextHeroes = ghServerFormationHeroes(next, data);
  var nextVersion = ghFormationVersion(data);
  var nextUpdatedAt = ghFormationUpdatedAt(data);
  var previousVersion = active.formationVersion;
  var formationChanged = !ghFormationMatches(active.formation, data);
  var recordChanged = nextUpdatedAt !== active.formationUpdatedAt;
  var versionChain = previousVersion !== null && previousVersion !== undefined && nextVersion !== null;
  var firstWrite = (previousVersion === null || previousVersion === undefined) && nextVersion === 1;
  if ((versionChain && (nextVersion < previousVersion || nextVersion > previousVersion + 1 ||
        (nextVersion === previousVersion && (formationChanged || recordChanged)))) ||
      (!versionChain && !firstWrite && (formationChanged || recordChanged))) {
    // Several formation writes happened without a server run sync. Their
    // intermediate intervals cannot be reconstructed from the latest record.
    // Keep time already verified, but credit nobody during this unknown gap.
    active.partyAt = Math.max(Number(active.partyAt || active.startedAt), now);
    active.formation = next;
    active.formationHeroes = nextHeroes;
    active.formationVersion = nextVersion;
    active.formationUpdatedAt = nextUpdatedAt;
    return;
  }
  if (formationChanged) {
    // A persisted formation record carries the iDos server write time. If the
    // client delays sync until victory, do not credit the old party until sync.
    var record = data.Private && data.Private.grind_formation_v2;
    var changedAt = record && new Date(record.UpdatedAt).getTime();
    var cutoff = isFinite(changedAt) && changedAt >= Number(active.partyAt || active.startedAt) &&
      changedAt <= now ? changedAt : now;
    ghAccrueParticipation(active, cutoff);
    active.formation = next;
    active.formationHeroes = nextHeroes;
  } else if (JSON.stringify(active.formationHeroes || []) !== JSON.stringify(nextHeroes)) {
    ghAccrueParticipation(active, now);
    active.formationHeroes = nextHeroes;
  }
  active.formationVersion = nextVersion;
  active.formationUpdatedAt = nextUpdatedAt;
  ghAccrueParticipation(active, now);
}

function ghNextXP(level) { return level >= GH_HERO_LEVEL_CAP ? 0 : 50 + 30 * (level - 1); }

function ghAwardXP(progress, heroIDs, amount) {
  var awards = [];
  heroIDs.forEach(function (id) {
    var current = progress[id] || {};
    var before = Math.max(1, Math.min(GH_HERO_LEVEL_CAP, Math.floor(Number(current.level) || 1)));
    var level = before;
    var xp = level >= GH_HERO_LEVEL_CAP ? 0 : Math.max(0, Math.floor(Number(current.xp) || 0)) + amount;
    while (level < GH_HERO_LEVEL_CAP && xp >= ghNextXP(level)) {
      xp -= ghNextXP(level);
      level++;
    }
    if (level >= GH_HERO_LEVEL_CAP) xp = 0;
    progress[id] = { level: level, xp: xp };
    awards.push({ heroID: id, amount: amount, previousLevel: before, level: level, xp: xp });
  });
  return awards;
}

function ghFormationMatches(signature, data) {
  try {
    // Older run markers also contain capacity. Unlocking a slot does not change a running party.
    return JSON.stringify(JSON.parse(signature).slots) === JSON.stringify(JSON.parse(ghFormationSignature(data)).slots);
  } catch (e) { return false; }
}

function ghWrite(bucket, key, value) {
  var result = server.SetUserCustomData(bucket, key, JSON.stringify(value));
  if (!result.Success) throw new Error("stage_state_write_failed: " + result.Error);
}

handlers.getPartySlotPrices = function () {
  return { slot2: GH_PARTY_SLOT_COSTS[2], slot3: GH_PARTY_SLOT_COSTS[3] };
};

handlers.unlockPartySlot = function (args) {
  var slot = Number(args && args.slot);
  if (slot !== 2 && slot !== 3) return { unlocked: false, reason: "invalid_slot" };
  var data = server.GetUserCustomData();
  if (!data.Success) throw new Error("party_state_read_failed: " + data.Error);
  var capacity = Number(data.Data.ReadOnly && data.Data.ReadOnly[GH_PARTY_CAPACITY_KEY] &&
    data.Data.ReadOnly[GH_PARTY_CAPACITY_KEY].Value || 1);
  if (capacity >= slot) return { unlocked: false, reason: "already_unlocked", capacity: capacity };
  if (slot !== capacity + 1) return { unlocked: false, reason: "previous_slot_locked" };
  var cost = GH_PARTY_SLOT_COSTS[slot];
  var inventory = server.ReadUserData(["InventoryV2"]);
  var gold = Number(inventory && inventory.InventoryV2 && inventory.InventoryV2.VirtualCurrencies &&
    inventory.InventoryV2.VirtualCurrencies.GOLD && inventory.InventoryV2.VirtualCurrencies.GOLD.Amount || 0);
  if (gold < cost) return { unlocked: false, reason: "not_enough_gold" };
  var charge = server.ApplyResourceOperation({
    Reason: "grind_party_slot_" + slot,
    Operation: { Consume: { Standard: { Entries: [
      { Type: "VirtualCurrency", CurrencyID: "GOLD", Amount: cost },
    ] } } },
  });
  if (!charge.Success) return { unlocked: false, reason: "not_enough_gold" };
  var saved = server.SetUserCustomData("ReadOnly", GH_PARTY_CAPACITY_KEY, String(slot));
  if (!saved.Success) {
    // Restore the player's Gold if the protected capacity write fails.
    var refund = server.ApplyResourceOperation({ Reason: "grind_party_slot_" + slot + "_refund",
      Operation: { Grant: { Standard: { Entries: [
        { Type: "VirtualCurrency", CurrencyID: "GOLD", Amount: cost },
      ] } } } });
    throw new Error("party_state_write_failed: " + saved.Error + (refund.Success ? "" : "; refund_failed: " + refund.Error));
  }
  return { unlocked: true, capacity: slot, goldSpent: cost };
};

handlers.startStageRun = function (args, context) {
  var stage = ghStage(args && args.stageId);
  if (!stage) return { accepted: false, reason: "unknown_stage" };
  var data = server.GetUserCustomData();
  if (!data.Success) throw new Error("stage_state_read_failed: " + data.Error);
  var progress = ghProgress(data.Data);
  if (stage.index >= progress.highestUnlocked)
    return { accepted: false, reason: "stage_locked" };
  var now = ghNow(context);
  var runId = stage.config.id + ":" + now + ":" + Math.floor(Math.random() * 1000000000);
  var formation = ghFormationSignature(data.Data);
  var formationHeroes = ghServerFormationHeroes(formation, data.Data);
  var participation = {};
  formationHeroes.forEach(function (id) { participation[id] = 0; });
  ghWrite("Internal", GH_ACTIVE_KEY, {
    id: runId, stageId: stage.config.id, startedAt: now, status: "active",
    formation: formation, formationHeroes: formationHeroes,
    formationVersion: ghFormationVersion(data.Data),
    formationUpdatedAt: ghFormationUpdatedAt(data.Data), equipment: ghEquipmentSignature(data.Data),
    partyAt: now, participation: participation,
  });
  return { accepted: true, runId: runId, stageId: stage.config.id,
    minimumClearSeconds: stage.config.minSeconds };
};

handlers.failStageRun = function (args, context) {
  var data = server.GetUserCustomData();
  if (!data.Success) throw new Error("stage_state_read_failed: " + data.Error);
  var active = ghReadJson(data.Data.Internal, GH_ACTIVE_KEY, null);
  if (!active || active.id !== (args && args.runId) || active.status !== "active")
    return { closed: false, reason: "run_not_active" };
  active.status = "failed";
  active.participation = {};
  ghWrite("Internal", GH_ACTIVE_KEY, active);
  return { closed: true };
};

// Live management changes are persisted in protected Grind equipment state.
// Refresh only the active marker from those server-side records; the client supplies no stats.
handlers.syncStageRunParty = function (args, context) {
  var data = server.GetUserCustomData();
  if (!data.Success) throw new Error("stage_state_read_failed: " + data.Error);
  var active = ghReadJson(data.Data.Internal, GH_ACTIVE_KEY, null);
  if (!active || active.id !== (args && args.runId) || active.status !== "active")
    return { synced: false, reason: "run_not_active" };
  ghSyncParticipation(active, data.Data, ghNow(context));
  active.equipment = ghEquipmentSignature(data.Data);
  ghWrite("Internal", GH_ACTIVE_KEY, active);
  return { synced: true };
};

handlers.completeStageRun = function (args, context) {
  var stage = ghStage(args && args.stageId);
  if (!stage) return { accepted: false, reason: "unknown_stage" };
  var data = server.GetUserCustomData();
  if (!data.Success) throw new Error("stage_state_read_failed: " + data.Error);
  var progress = ghProgress(data.Data);
  var active = ghReadJson(data.Data.Internal, GH_ACTIVE_KEY, null);
  if (!active || active.status !== "active" || active.id !== (args && args.runId) ||
      active.stageId !== stage.config.id)
    return { accepted: false, reason: "run_not_active" };
  if (stage.index >= progress.highestUnlocked)
    return { accepted: false, reason: "stage_locked" };
  var seconds = (ghNow(context) - Number(active.startedAt)) / 1000;
  if (!isFinite(seconds) || seconds < stage.config.minSeconds)
    return { accepted: false, reason: "implausible_time" };
  if (seconds > GH_MAX_SECONDS)
    return { accepted: false, reason: "run_expired" };
  if (!ghFormationMatches(active.formation, data.Data) ||
      active.equipment !== ghEquipmentSignature(data.Data))
    return { accepted: false, reason: "party_changed" };

  var completedAt = ghNow(context);
  // Even when the final slots match, intervening private-data writes may have
  // removed and re-added a hero. Reconcile the server record before awarding.
  ghSyncParticipation(active, data.Data, completedAt);
  var owned = ghOwnedHeroes();
  var runMs = completedAt - Number(active.startedAt);
  var candidateIDs = Object.keys(owned);
  Object.keys(active.participation).forEach(function (id) {
    if (candidateIDs.indexOf(id) < 0) candidateIDs.push(id);
  });
  var xpEligibility = candidateIDs.map(function (id) {
    var activeMs = Math.max(0, Number(active.participation[id]) || 0);
    var ratio = activeMs / runMs;
    // Only formation time is server-verifiable; the combat simulation's death
    // events are client-side and cannot be used to stop this clock securely.
    var reason = !owned[id] || Number(owned[id].Level) <= 0 ? "not_owned" :
      activeMs < GH_MIN_HERO_XP_PARTICIPATION_MS ? "minimum_time" :
      ratio < GH_MIN_HERO_XP_PARTICIPATION_RATIO ? "participation_ratio" : "eligible";
    return { heroID: id, activeMs: activeMs, runMs: runMs,
      ratio: ratio, eligible: reason === "eligible", reason: reason,
      xpGranted: reason === "eligible" ? stage.config.heroXP : 0 };
  });
  var qualified = xpEligibility.filter(function (entry) { return entry.eligible; })
    .map(function (entry) { return entry.heroID; });
  var heroProgress = ghReadJson(data.Data.ReadOnly, GH_HERO_XP_KEY, {});
  if (!heroProgress || typeof heroProgress !== "object" || Array.isArray(heroProgress)) heroProgress = {};
  var xpAwards = ghAwardXP(heroProgress, qualified, stage.config.heroXP);

  var firstClear = !Number(progress.completed[stage.config.id]);
  var best = Number(progress.bestSeconds[stage.config.id]);
  progress.bestSeconds[stage.config.id] = !isFinite(best) || best <= 0
    ? seconds : Math.min(best, seconds);
  progress.completed[stage.config.id] = Number(progress.completed[stage.config.id] || 0) + 1;
  progress.highestUnlocked = Math.max(progress.highestUnlocked,
    Math.min(GH_STAGES.length, stage.index + 2));
  active.status = "completed";
  active.completedAt = completedAt;
  var saved = server.BatchSetUserCustomData([
    { Bucket: "Internal", KeyID: GH_ACTIVE_KEY, Value: JSON.stringify(active) },
    { Bucket: "ReadOnly", KeyID: GH_PROGRESS_KEY, Value: JSON.stringify(progress) },
    { Bucket: "ReadOnly", KeyID: GH_HERO_XP_KEY, Value: JSON.stringify(heroProgress) },
  ]);
  if (!saved.Success) throw new Error("stage_state_write_failed: " + saved.Error);

  var entries = [
    { Type: "VirtualCurrency", CurrencyID: "GOLD", Amount: stage.config.gold },
    { Type: "Item", CatalogID: "Item", ItemID: ghChestItemID("stage_chest", stage.index), Amount: 1 },
  ];
  if (stage.config.bossChest)
    entries.push({ Type: "Item", CatalogID: "Item", ItemID: ghChestItemID("boss_chest", stage.index), Amount: 1 });
  if (firstClear && stage.config.firstItem)
    entries.push({ Type: "Item", CatalogID: "Item", ItemID: stage.config.firstItem, Amount: 1 });
  var grant = server.ApplyResourceOperation({
    Reason: "grind_stage_v2_clear:" + active.id,
    Operation: { Grant: { Standard: { Entries: entries } } },
  });
  if (!grant.Success) throw new Error("stage_reward_failed: " + grant.Error);
  var quest = server.AddQuestProgress("stage_cleared", 1);
  if (!quest.Success) log.Warning("stage quest progress failed", { error: quest.Error });
  return {
    accepted: true, stageId: stage.config.id, runId: active.id,
    serverSeconds: seconds, firstClear: firstClear, progress: progress,
    xpAwards: xpAwards, xpEligibility: xpEligibility, heroProgress: heroProgress,
    rewards: { gold: stage.config.gold, chestItemID: ghChestItemID("stage_chest", stage.index),
      bossChestItemID: stage.config.bossChest ? ghChestItemID("boss_chest", stage.index) : null,
      firstItemID: firstClear ? stage.config.firstItem || null : null },
  };
};

function ghChestItemID(base, stageIndex) {
  return stageIndex < 10 ? base : base + "_act" + (stageIndex < 20 ? 2 : 3);
}
