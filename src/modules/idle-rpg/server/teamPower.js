// Concatenate after stageRewards.js and grindEquipment.js. The publisher prepends
// the canonical ghCombatPower function from game/powerFormula.js.
var GH_TEAM_POWER_KEY = "grind_team_power_v1";
var GH_TEAM_TOP_KEY = "grind_team_power_top_v1";
var GH_TEAM_TOP_LIMIT = 100;
var GH_TEAM_ARCHETYPES = {
  Knight: { hit: 1, cadence: 1, moveSpeed: 140 },
  Archer: { hit: 0.9, cadence: 1.2, moveSpeed: 162 },
  Mage: { hit: 1.35, cadence: 0.8, moveSpeed: 130 },
};

function ghPowerCurve(spec, base, step, firstStep) {
  if (!spec || !spec.Shape || spec.Shape === "Flat") return base;
  var n = Math.max(0, step - firstStep);
  if (spec.Shape === "PerStep") return base + Number(spec.PerStep || 0) * n;
  if (spec.Shape === "PerStepRate") return base * (1 + Number(spec.PerStepRate || 0) * n);
  if (spec.Shape === "Geometric") return base * Math.pow(1 + Number(spec.GrowthRate || 0), n);
  // Fail closed if a new curve shape is configured. Never publish an estimate.
  throw new Error("unsupported_team_power_curve: " + spec.Shape);
}

function ghPowerStat(section, def, model, ids, rank) {
  var binding = def.Presets && def.Presets.Stats;
  var preset = binding && binding.PresetID && section.Presets && section.Presets.Stats &&
    section.Presets.Stats[binding.PresetID];
  var merged = Object.assign({}, preset && preset.Stats || {}, def.Stats || {});
  (binding && binding.Remove || []).forEach(function (id) { delete merged[id]; });
  for (var i = 0; i < ids.length; i++) {
    var stat = merged[ids[i]];
    if (!stat) continue;
    var statID = stat.StatID || ids[i];
    var level = Number(model && model.StatLevels && model.StatLevels[statID] || 0);
    var value = ghPowerCurve(stat.ValueCurve, Number(stat.BaseStatValue || 0), level, 0);
    return ghPowerCurve(stat.RankCurve, value, rank, 1);
  }
  return 0;
}

function ghPowerGearBonuses(equipment, heroID, ctx) {
  var result = { attack: 0, maxHp: 0, defence: 0, attackSpeed: 0, moveSpeed: 0 };
  var slots = equipment.heroes[heroID] || {};
  GH_EQUIPMENT_SLOTS.forEach(function (slot) {
    var ref = slots[slot];
    if (!ref) return;
    var instance = equipment.items[ref];
    var def = ghItemDefinition(instance, ctx);
    if (!def) return;
    var flat = def.Stats && def.Stats.FlatBonuses || {};
    var scale = ghPowerCurve(def.Upgrade && def.Upgrade.FlatBonusCurve, 1,
      Math.max(1, Number(instance.Level || 1)), 1);
    result.attack += (Number(flat.Damage || 0) + Number(flat.Attack || 0)) * scale;
    result.maxHp += (Number(flat.Health || 0) + Number(flat.HP || 0) + Number(flat.MaxHp || 0)) * scale;
    result.defence += (Number(flat.Armor || 0) + Number(flat.Defense || 0) + Number(flat.Defence || 0)) * scale;
    result.attackSpeed += Number(flat.AttackSpeed || 0) * scale;
    result.moveSpeed += Number(flat.MoveSpeed || 0) * scale;
  });
  return result;
}

function ghPowerForHero(heroID, ctx, equipment, section) {
  var def = ctx.heroDefinitions[heroID];
  if (!def || !ghHeroOwned(heroID, ctx)) return 0;
  var model = ctx.characters[heroID] || {};
  var rank = Math.max(1, Number(model.Level || 1));
  var rankScale = ghPowerCurve(def.RankStatCurve, 1, rank, 1);
  var health = ghPowerStat(section, def, model, ["Health", "HP", "MaxHp"], rank) * rankScale;
  var damage = ghPowerStat(section, def, model, ["Damage", "Attack", "ATK", "Magic"], rank) * rankScale;
  var armor = ghPowerStat(section, def, model, ["Armor", "Defense", "DEF"], rank) * rankScale;
  var speed = ghPowerStat(section, def, model, ["AttackSpeed"], rank);
  var allMight = ghPowerStat(section, def, model, ["AllMight"], rank);
  var gear = ghPowerGearBonuses(equipment, heroID, ctx);
  var archetype = GH_TEAM_ARCHETYPES[heroID];
  var global = 1 + allMight;
  return ghCombatPower({
    maxHp: Math.max(1, Math.max(1, health * global) + gear.maxHp),
    attack: Math.max(1, (damage * global + gear.attack) * archetype.hit),
    defence: Math.max(0, armor + gear.defence),
    attackSpeed: Math.max(0.1, (Math.max(0.1, speed) + gear.attackSpeed) * archetype.cadence),
    moveSpeed: Math.max(1, archetype.moveSpeed + gear.moveSpeed),
  });
}

function ghCalculateTeamPower(data) {
  var ctx = ghEquipmentContext(data);
  var section = server.GetTitleConfig("Character");
  if (!section || section.Success === false) throw new Error("team_character_config_unavailable");
  var root = section.Data || section;
  var character = root.Character || root.CharacterDefinitions;
  if (!character || !character.Definitions) throw new Error("team_character_config_invalid");
  var equipment = ghLoadEquipment(ctx).equipment;
  var signature = ghFormationSignature(data);
  var heroes = ghServerFormationHeroes(signature, data);
  var scores = heroes.map(function (id) { return { heroID: id, power: ghPowerForHero(id, ctx, equipment, character) }; });
  return { power: scores.reduce(function (sum, row) { return sum + row.power; }, 0), heroes: scores };
}

function ghTopRows(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.entries)) return [];
  return raw.entries.filter(function (row) {
    return row && typeof row.playerId === "string" && row.playerId &&
      Number.isSafeInteger(row.power) && row.power > 0;
  }).slice(0, GH_TEAM_TOP_LIMIT);
}

function ghTopSort(a, b) {
  return b.power - a.power || String(a.scoreAt).localeCompare(String(b.scoreAt)) ||
    a.playerId.localeCompare(b.playerId);
}

function ghTopApply(entries, row) {
  var next = entries.filter(function (entry) { return entry.playerId !== row.playerId; });
  // If a full Top 100 loses a member, we cannot recover the 101st player from
  // this bounded projection. Never keep a now-weak entry just to fill a slot.
  var floor = next.length ? next[next.length - 1].power : 0;
  if (row.power > 0 && (entries.length < GH_TEAM_TOP_LIMIT || row.power >= floor)) next.push(row);
  next.sort(ghTopSort);
  return next.slice(0, GH_TEAM_TOP_LIMIT);
}

function ghTitleTopRecord() {
  var read = server.GetTitleCustomData();
  if (!read.Success) throw new Error("team_top_read_failed: " + read.Error);
  var d = read.Data || {};
  var runtime = d.Runtime || {};
  return runtime.Private && runtime.Private[GH_TEAM_TOP_KEY] || null;
}

function ghPublishTop(row, mustCheckMissing) {
  for (var attempt = 0; attempt < 5; attempt++) {
    var record = ghTitleTopRecord();
    var current = record && record.Value ? JSON.parse(record.Value) : null;
    var before = ghTopRows(current);
    var old = before.filter(function (entry) { return entry.playerId === row.playerId; })[0];
    if (old && old.power === row.power && !mustCheckMissing) return before;
    var next = ghTopApply(before, row);
    if (JSON.stringify(next) === JSON.stringify(before)) return before;
    var write = server.SetTitleCustomData("Private", GH_TEAM_TOP_KEY,
      JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), entries: next }),
      record ? Number(record.Version) : 0);
    if (write.Success) return next;
    // A concurrent writer won the version check. Re-read and recompute.
    if (attempt === 4) throw new Error("team_top_cas_failed: " + write.Error);
  }
  throw new Error("team_top_cas_exhausted");
}

function ghRecalculateAndPublish(context) {
  // Close elapsed reward days against the prior leaderboard before changing it.
  if (typeof ghRewardCatchUp === "function") ghRewardCatchUp(new Date().toISOString());
  var read = server.GetUserCustomData();
  if (!read.Success) throw new Error("team_power_read_failed: " + read.Error);
  var data = read.Data;
  var calculated = ghCalculateTeamPower(data);
  if (!Number.isSafeInteger(calculated.power) || calculated.power < 0)
    throw new Error("team_power_invalid");
  var prior = ghReadJson(data.ReadOnly, GH_TEAM_POWER_KEY, null);
  var changed = !prior || prior.power !== calculated.power;
  if (changed) {
    var saved = server.SetUserCustomData("ReadOnly", GH_TEAM_POWER_KEY,
      JSON.stringify({ version: 1, power: calculated.power, updatedAt: new Date().toISOString() }));
    if (!saved.Success) throw new Error("team_power_write_failed: " + saved.Error);
  }
  var profile = server.ReadUserData(["PublicData"]);
  var publicData = profile && profile.PublicData || {};
  var oldRows = ghTopRows((function () { var r = ghTitleTopRecord(); return r && r.Value ? JSON.parse(r.Value) : null; })());
  var existing = oldRows.filter(function (row) { return row.playerId === context.UserID; })[0];
  var row = { playerId: context.UserID,
    displayName: String(publicData.Username || "Player").slice(0, 40),
    avatar: typeof publicData.AvatarUrl === "string" ? publicData.AvatarUrl : null,
    power: calculated.power,
    scoreAt: existing && existing.power === calculated.power ? existing.scoreAt : new Date().toISOString() };
  var entries = changed || !existing || existing.power !== row.power ||
      existing.displayName !== row.displayName || existing.avatar !== row.avatar
    ? ghPublishTop(row, true) : oldRows;
  return { power: calculated.power, heroes: calculated.heroes, entries: entries };
}

function ghPublicTeamTop(result, context) {
  var rank = 0;
  var entries = result.entries.map(function (row, index) {
    if (row.playerId === context.UserID) rank = index + 1;
    return { rank: index + 1, displayName: row.displayName || "Player",
      avatar: row.avatar || null, power: row.power, isYou: row.playerId === context.UserID };
  });
  return { power: result.power, heroes: result.heroes, rank: rank || null,
    entries: entries, topLimit: GH_TEAM_TOP_LIMIT };
}

handlers.getTeamPowerLeaderboard = function (_args, context) {
  return ghPublicTeamTop(ghRecalculateAndPublish(context), context);
};

handlers.recalculateTeamPower = function (_args, context) {
  var result = ghRecalculateAndPublish(context);
  return { power: result.power, heroes: result.heroes };
};
