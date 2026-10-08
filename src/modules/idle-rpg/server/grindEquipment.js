// Concatenated after stageRewards.js for the single-file iDos CloudCode revision.
// Native Character.EquipItems is never an authority for Grind Heroes.
var GH_EQUIPMENT_KEY = "grind_equipment_v1";
var GH_EQUIPMENT_HEROES = ["Knight", "Archer", "Mage"];
var GH_EQUIPMENT_SLOTS = ["Helmet", "Armor", "Gloves", "Boots", "Weapon", "Offhand"];
var GH_EQUIPMENT_LEVELS = { Common: 1, Uncommon: 5, Rare: 10, Epic: 15, Legendary: 20 };

function ghEmptyEquipment() {
  var heroes = {};
  GH_EQUIPMENT_HEROES.forEach(function (heroID) {
    var slots = {};
    GH_EQUIPMENT_SLOTS.forEach(function (slot) { slots[slot] = null; });
    heroes[heroID] = slots;
  });
  return { version: 1, heroes: heroes, items: {} };
}

function ghEquipmentContext(data) {
  var player = server.ReadUserData(["InventoryV2", "Character"]);
  if (!player || !player.InventoryV2) throw new Error("grind_inventory_unavailable");
  var configured = server.GetTitleConfig("Item", "Character");
  if (!configured || configured.Success === false)
    throw new Error("grind_item_config_unavailable: " + (configured && configured.Error || "missing"));
  var root = configured.Data || configured;
  var item = root.Item || root.ItemDefinitions;
  var character = root.Character || root.CharacterDefinitions;
  if (!item || !item.Catalogs || !character || !character.Definitions)
    throw new Error("grind_equipment_config_shape_invalid");
  return {
    records: data,
    // CloudCode's ReadUserData exposes aggregate Items counts but currently omits
    // UnstackableItems. Native Character.EquipItems is the attestation for an
    // exact owned instance; it checks ownership, class and slot before writing.
    counts: player.InventoryV2.Items || {},
    characters: player.Character && player.Character.Characters || {},
    catalogs: item.Catalogs,
    heroDefinitions: character.Definitions,
  };
}

function ghItemDefinition(instance, ctx) {
  if (!instance || !instance.ItemID) return null;
  var catalogID = instance.CatalogID || "Item";
  var catalog = ctx.catalogs[catalogID];
  var found = catalog && catalog.Items && catalog.Items[instance.ItemID];
  if (found) return found;
  // Old instances may carry a former CatalogID. Only accept an unambiguous ID.
  var matches = 0;
  Object.keys(ctx.catalogs).forEach(function (id) {
    var candidate = ctx.catalogs[id] && ctx.catalogs[id].Items && ctx.catalogs[id].Items[instance.ItemID];
    if (candidate) { matches++; found = candidate; }
  });
  return matches === 1 ? found : null;
}

function ghGrindLevel(heroID, ctx) {
  var progress = ghReadJson(ctx.records.ReadOnly, GH_HERO_XP_KEY, {});
  var raw = progress && progress[heroID] && Number(progress[heroID].level);
  return isFinite(raw) && raw >= 1 ? Math.max(1, Math.min(GH_HERO_LEVEL_CAP, Math.floor(raw))) : 1;
}

function ghRequiredLevel(def) {
  var explicit = def && (def.Metadata && def.Metadata.RequiredHeroLevel ||
    def.CustomData && def.CustomData.RequiredHeroLevel);
  if (explicit !== undefined && explicit !== null && explicit !== "") {
    var level = Number(explicit);
    return Number.isSafeInteger(level) && level >= 1 ? level : null;
  }
  return GH_EQUIPMENT_LEVELS[def && def.Metadata && def.Metadata.RarityID] || null;
}

function ghHeroOwned(heroID, ctx) {
  var def = ctx.heroDefinitions[heroID];
  if (!def) return false;
  var model = ctx.characters[heroID];
  return Number(model && model.Level) > 0 || !!(def.Unlock && def.Unlock.UnlockedByDefault);
}

function ghFindAssignment(equipment, instanceID) {
  for (var h = 0; h < GH_EQUIPMENT_HEROES.length; h++) {
    var heroID = GH_EQUIPMENT_HEROES[h];
    for (var s = 0; s < GH_EQUIPMENT_SLOTS.length; s++) {
      var slot = GH_EQUIPMENT_SLOTS[s];
      if (equipment.heroes[heroID][slot] === instanceID) return { heroID: heroID, slot: slot };
    }
  }
  return null;
}

function ghNativeInstance(ctx, heroID, slot, instanceID) {
  var native = ctx.characters[heroID] && ctx.characters[heroID].Equipment &&
    ctx.characters[heroID].Equipment[slot];
  if (!native || native.ItemInstanceID !== instanceID || !native.ItemID) return null;
  return { ItemID: native.ItemID, CatalogID: native.CatalogID || "Item",
    Level: native.Level || 1 };
}

function ghValidateEquip(equipment, heroID, slot, instanceID, ctx, instance) {
  if (GH_EQUIPMENT_HEROES.indexOf(heroID) < 0 || !ghHeroOwned(heroID, ctx)) return "HERO_NOT_OWNED";
  if (GH_EQUIPMENT_SLOTS.indexOf(slot) < 0 ||
      !ctx.heroDefinitions[heroID].Equipment ||
      !ctx.heroDefinitions[heroID].Equipment.Slots ||
      !ctx.heroDefinitions[heroID].Equipment.Slots[slot]) return "INVALID_SLOT";
  if (typeof instanceID !== "string" || !instanceID) return "ITEM_NOT_OWNED";
  if (!instance || !instance.ItemID) return "ITEM_NOT_OWNED";
  var count = ctx.counts[instance.ItemID];
  if (!count || Number(count.UnstackableAmount) < 1) return "ITEM_NOT_OWNED";
  var def = ghItemDefinition(instance, ctx);
  if (!def || def.IsStackable !== false || !def.Equipment) return "NOT_EQUIPMENT";
  var allowedSlots = def.Equipment.AllowedSlotIDs || [];
  if (allowedSlots.indexOf(slot) < 0) return "INVALID_SLOT";
  var allowedHeroes = def.Equipment.AllowedCharacterIDs || [];
  if (allowedHeroes.length && allowedHeroes.indexOf(heroID) < 0) return "WRONG_CHARACTER";
  var required = ghRequiredLevel(def);
  if (required === null) return "INVALID_ITEM_LEVEL_RULE";
  if (ghGrindLevel(heroID, ctx) < required) return "HERO_LEVEL_TOO_LOW";
  var assigned = ghFindAssignment(equipment, instanceID);
  if (assigned && (assigned.heroID !== heroID || assigned.slot !== slot))
    return "ITEM_ALREADY_EQUIPPED_ELSEWHERE";
  return null;
}

function ghCountAvailable(equipment, heroID, slot, itemID, ctx) {
  var assigned = 0;
  GH_EQUIPMENT_HEROES.forEach(function (id) {
    GH_EQUIPMENT_SLOTS.forEach(function (otherSlot) {
      if (id === heroID && otherSlot === slot) return;
      var ref = equipment.heroes[id][otherSlot];
      if (ref && equipment.items[ref] && equipment.items[ref].ItemID === itemID) assigned++;
    });
  });
  return assigned < Number(ctx.counts[itemID] && ctx.counts[itemID].UnstackableAmount || 0);
}

function ghSaveEquipment(equipment) {
  var referenced = {};
  GH_EQUIPMENT_HEROES.forEach(function (heroID) {
    GH_EQUIPMENT_SLOTS.forEach(function (slot) {
      var id = equipment.heroes[heroID][slot];
      if (id && equipment.items[id]) referenced[id] = equipment.items[id];
    });
  });
  equipment.items = referenced;
  var write = server.SetUserCustomData("ReadOnly", GH_EQUIPMENT_KEY, JSON.stringify(equipment));
  if (!write.Success) throw new Error("grind_equipment_write_failed: " + write.Error);
}

function ghLoadEquipment(ctx) {
  var record = ctx.records.ReadOnly && ctx.records.ReadOnly[GH_EQUIPMENT_KEY];
  var state = ghEmptyEquipment();
  var changed = false;
  var migrated = !record;
  if (record) {
    var saved = ghReadJson(ctx.records.ReadOnly, GH_EQUIPMENT_KEY, null);
    if (!saved || saved.version !== 1 || !saved.heroes || typeof saved.heroes !== "object") {
      log.Warning("Invalid Grind equipment record; refusing native re-import");
      changed = true;
    } else {
      state.items = saved.items && typeof saved.items === "object" &&
        !Array.isArray(saved.items) ? saved.items : {};
      GH_EQUIPMENT_HEROES.forEach(function (heroID) {
        GH_EQUIPMENT_SLOTS.forEach(function (slot) {
          var id = saved.heroes[heroID] && saved.heroes[heroID][slot];
          if (typeof id === "string" && id) state.heroes[heroID][slot] = id;
          else if (id !== null) changed = true;
        });
      });
    }
  } else {
    // One-time migration. Invalid native gear stays owned, but is not Grind-equipped.
    GH_EQUIPMENT_HEROES.forEach(function (heroID) {
      GH_EQUIPMENT_SLOTS.forEach(function (slot) {
        var worn = ctx.characters[heroID] && ctx.characters[heroID].Equipment &&
          ctx.characters[heroID].Equipment[slot];
        var instanceID = worn && worn.ItemInstanceID;
        var instance = ghNativeInstance(ctx, heroID, slot, instanceID);
        if (instance && !ghValidateEquip(state, heroID, slot, instanceID, ctx, instance)) {
          state.heroes[heroID][slot] = instanceID;
          state.items[instanceID] = instance;
        }
      });
    });
    changed = true;
  }
  // A consumed/sold/changed instance can never keep a gameplay bonus.
  var usedCounts = {};
  GH_EQUIPMENT_HEROES.forEach(function (heroID) {
    GH_EQUIPMENT_SLOTS.forEach(function (slot) {
      var instanceID = state.heroes[heroID][slot];
      if (!instanceID) return;
      state.heroes[heroID][slot] = null;
      var instance = state.items[instanceID];
      var problem = ghValidateEquip(state, heroID, slot, instanceID, ctx, instance);
      // Marketplace validates native EquippedSlot at the listing mutation. A direct native
      // unequip must also revoke this Grind assignment before any new stage signature.
      var native = ghNativeInstance(ctx, heroID, slot, instanceID);
      if (!problem && (!native || native.ItemID !== instance.ItemID))
        problem = "NATIVE_ASSIGNMENT_MISSING";
      if (!problem && usedCounts[instance.ItemID] >=
          Number(ctx.counts[instance.ItemID].UnstackableAmount)) problem = "ITEM_NOT_OWNED";
      if (problem) {
        changed = true;
        log.Warning("Discarded invalid Grind equipment reference", { heroID: heroID, slot: slot, reason: problem });
      } else {
        state.heroes[heroID][slot] = instanceID;
        usedCounts[instance.ItemID] = (usedCounts[instance.ItemID] || 0) + 1;
      }
    });
  });
  if (changed) ghSaveEquipment(state);
  return { equipment: state, migrated: migrated, cleaned: changed && !migrated };
}

function ghGrindEquipmentSignature(data) {
  var records = data;
  if (!records) {
    var result = server.GetUserCustomData();
    if (!result.Success) throw new Error("grind_equipment_read_failed: " + result.Error);
    records = result.Data;
  }
  var ctx = ghEquipmentContext(records);
  return JSON.stringify(ghLoadEquipment(ctx).equipment.heroes);
}

handlers.getGrindEquipment = function () {
  var result = server.GetUserCustomData();
  if (!result.Success) throw new Error("grind_equipment_read_failed: " + result.Error);
  return ghLoadEquipment(ghEquipmentContext(result.Data));
};

handlers.equipGrindItem = function (args) {
  var result = server.GetUserCustomData();
  if (!result.Success) throw new Error("grind_equipment_read_failed: " + result.Error);
  var ctx = ghEquipmentContext(result.Data);
  var state = ghLoadEquipment(ctx).equipment;
  var heroID = args && args.heroID;
  var slot = args && args.slot;
  var instanceID = args && args.itemInstanceID;
  var instance = ghNativeInstance(ctx, heroID, slot, instanceID);
  var problem = ghValidateEquip(state, heroID, slot, instanceID, ctx, instance);
  if (!problem && !ghCountAvailable(state, heroID, slot, instance.ItemID, ctx))
    problem = "ITEM_NOT_OWNED";
  if (problem) return { equipped: false, reason: problem, equipment: state };
  if (state.heroes[heroID][slot] !== instanceID) {
    state.heroes[heroID][slot] = instanceID;
    state.items[instanceID] = instance;
    ghSaveEquipment(state);
  }
  return { equipped: true, equipment: state };
};

handlers.unequipGrindItem = function (args) {
  var result = server.GetUserCustomData();
  if (!result.Success) throw new Error("grind_equipment_read_failed: " + result.Error);
  var ctx = ghEquipmentContext(result.Data);
  var state = ghLoadEquipment(ctx).equipment;
  var heroID = args && args.heroID;
  var slot = args && args.slot;
  if (GH_EQUIPMENT_HEROES.indexOf(heroID) < 0 || !ghHeroOwned(heroID, ctx))
    return { unequipped: false, reason: "HERO_NOT_OWNED", equipment: state };
  if (GH_EQUIPMENT_SLOTS.indexOf(slot) < 0)
    return { unequipped: false, reason: "INVALID_SLOT", equipment: state };
  var priorInstanceID = state.heroes[heroID][slot];
  if (priorInstanceID) {
    state.heroes[heroID][slot] = null;
    ghSaveEquipment(state);
  }
  return { unequipped: true, unequippedInstanceID: priorInstanceID, equipment: state };
};

handlers.equipBestGrindHero = function (args) {
  var result = server.GetUserCustomData();
  if (!result.Success) throw new Error("grind_equipment_read_failed: " + result.Error);
  var ctx = ghEquipmentContext(result.Data);
  var state = ghLoadEquipment(ctx).equipment;
  var heroID = args && args.heroID;
  if (GH_EQUIPMENT_HEROES.indexOf(heroID) < 0 || !ghHeroOwned(heroID, ctx))
    return { equipped: false, reason: "HERO_NOT_OWNED", equipment: state };
  var next = ghEmptyEquipment();
  GH_EQUIPMENT_HEROES.forEach(function (id) {
    GH_EQUIPMENT_SLOTS.forEach(function (slot) { next.heroes[id][slot] = state.heroes[id][slot]; });
  });
  next.items = Object.assign({}, state.items);
  var proposals = args && args.slots || {};
  if (!proposals || typeof proposals !== "object" || Array.isArray(proposals))
    return { equipped: false, reason: "INVALID_SLOT", equipment: state };
  Object.keys(proposals).forEach(function (slot) {
    if (GH_EQUIPMENT_SLOTS.indexOf(slot) >= 0) next.heroes[heroID][slot] = null;
  });
  // The client may propose its best visible instances, but every one needs a
  // successful native ownership attestation and full Grind validation.
  for (var key in proposals) {
    if (GH_EQUIPMENT_SLOTS.indexOf(key) < 0) return { equipped: false, reason: "INVALID_SLOT", equipment: state };
    var instanceID = proposals[key];
    var instance = ghNativeInstance(ctx, heroID, key, instanceID);
    var problem = ghValidateEquip(next, heroID, key, instanceID, ctx, instance);
    if (!problem && !ghCountAvailable(next, heroID, key, instance.ItemID, ctx))
      problem = "ITEM_NOT_OWNED";
    if (problem) return { equipped: false, reason: problem, equipment: state };
    next.heroes[heroID][key] = instanceID;
    next.items[instanceID] = instance;
  }
  if (JSON.stringify(next.heroes) !== JSON.stringify(state.heroes)) ghSaveEquipment(next);
  return { equipped: true, equipment: next };
};

handlers.isGrindEquipped = function (args) {
  var result = server.GetUserCustomData();
  if (!result.Success) throw new Error("grind_equipment_read_failed: " + result.Error);
  var state = ghLoadEquipment(ghEquipmentContext(result.Data)).equipment;
  var instanceID = args && args.itemInstanceID;
  var assignment = typeof instanceID === "string" ? ghFindAssignment(state, instanceID) : null;
  return { equipped: !!assignment, assignment: assignment };
};
