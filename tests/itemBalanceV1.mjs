// Canonical data for the DEV item balance pass. The Title still owns live item/lootbox data.
export const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
export const requiredLevels = [1, 5, 10, 15, 20];
export const families = {
  sword: { slot: "Weapon", heroes: ["Knight"], ids: ["wooden_sword", "bronze_sword", "iron_sword", "runeblade", "dragon_blade"], stats: [5, 9, 15, 24, 36].map(Damage => ({ Damage })) },
  shield: { slot: "Offhand", heroes: ["Knight"], ids: ["oak_shield", "reinforced_shield", "steel_bulwark", "runic_aegis", "sunforge_aegis"], stats: [{ Health: 25, Armor: 2 }, { Health: 40, Armor: 3 }, { Health: 60, Armor: 4 }, { Health: 85, Armor: 6 }, { Health: 120, Armor: 8 }] },
  helmet: { slot: "Helmet", heroes: [], ids: ["leather_helmet", "reinforced_helmet", "steel_helmet", "runic_helm", "phoenix_helm"], stats: [{ Health: 20, Armor: 1 }, { Health: 32, Armor: 2 }, { Health: 45, Armor: 3 }, { Health: 65, Armor: 4 }, { Health: 90, Armor: 5 }] },
  armor: { slot: "Armor", heroes: [], ids: ["leather_vest", "reinforced_vest", "chainmail", "knight_plate", "dragon_scale"], stats: [{ Health: 40, Armor: 1 }, { Health: 65, Armor: 2 }, { Health: 95, Armor: 3 }, { Health: 135, Armor: 4 }, { Health: 190, Armor: 6 }] },
  gloves: { slot: "Gloves", heroes: [], ids: ["worn_gloves", "training_gloves", "steel_gauntlets", "runebound_gloves", "titan_gauntlets"], stats: [{ Damage: 1, AttackSpeed: 0.03 }, { Damage: 2, AttackSpeed: 0.05 }, { Damage: 3, AttackSpeed: 0.07 }, { Damage: 5, AttackSpeed: 0.10 }, { Damage: 7, AttackSpeed: 0.13 }] },
  boots: { slot: "Boots", heroes: [], ids: ["traveler_boots", "scout_boots", "swift_boots", "windwalker_boots", "stormstride_boots"], stats: [5, 8, 11, 14, 18].map(MoveSpeed => ({ MoveSpeed })) },
  bow: { slot: "Weapon", heroes: ["Archer"], ids: ["hunter_bow", "recurve_bow", "silverwood_bow", "moonweave_bow", "starfall_bow"], stats: [5, 9, 15, 24, 36].map(Damage => ({ Damage })) },
  quiver: { slot: "Offhand", heroes: ["Archer"], ids: ["field_quiver", "arrow_quiver", "steelhead_quiver", "stormshot_quiver", "dragonflight_quiver"], stats: [{ Damage: 1, AttackSpeed: 0.03 }, { Damage: 2, AttackSpeed: 0.05 }, { Damage: 3, AttackSpeed: 0.07 }, { Damage: 5, AttackSpeed: 0.10 }, { Damage: 7, AttackSpeed: 0.13 }] },
  staff: { slot: "Weapon", heroes: ["Mage"], ids: ["apprentice_staff", "ashwood_staff", "crystal_staff", "sapphire_staff", "astral_staff"], stats: [5, 9, 15, 24, 36].map(Damage => ({ Damage })) },
  orb: { slot: "Offhand", heroes: ["Mage"], ids: ["apprentice_orb", "focus_orb", "sapphire_orb", "runic_orb", "celestial_orb"], stats: [3, 5, 8, 12, 17].map(Damage => ({ Damage })) },
};

// Percentages; each eligible family has equal weight within a rarity.
export const rarityTables = {
  act1_stage: [78, 20, 2, 0, 0],
  act1_boss: [58, 32, 9, 1, 0],
  act2_stage: [22, 52, 23, 3, 0],
  act2_boss: [10, 38, 42, 9.5, 0.5],
  act3_stage: [8, 25, 48, 18, 1],
  act3_boss: [3, 12, 47, 34, 4],
};

const copy = value => JSON.parse(JSON.stringify(value));
export const gearRows = Object.entries(families).flatMap(([family, info]) =>
  info.ids.map((id, tier) => ({ id, family, slot: info.slot, heroes: info.heroes,
    rarity: rarities[tier], requiredLevel: requiredLevels[tier], stats: info.stats[tier],
    icon: `assets/ui/icons/${family}/${id}.png` })));

export function makeItemConfig(current) {
  const result = copy(current);
  const items = result.Catalogs.Item.Items;
  for (const row of gearRows) {
    const template = items[row.id] ?? items[families[row.family].ids.find(id => items[id])];
    const item = copy(template);
    item.ItemID = row.id;
    item.DisplayName = row.id.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
    item.ItemClass = row.slot;
    item.Tags = [row.family, "grind-gear"];
    item.Stats = { ...item.Stats, FlatBonuses: row.stats, PercentBonuses: {}, Power: 0 };
    item.Equipment = { ...item.Equipment, AllowedSlotIDs: [row.slot],
      AllowedCharacterIDs: row.heroes, MinCharacterLevel: 0 };
    item.Metadata = { ...item.Metadata, RarityID: row.rarity };
    item.AssetPaths = { icon: row.icon };
    item.Upgrade = { ...copy(items.wooden_sword.Upgrade),
      FlatBonusCurve: { Shape: "PerStepRate", PerStepRate: 0.06 } };
    items[row.id] = item;
  }
  for (const kind of ["stage", "boss"]) for (const act of [2, 3]) {
    const id = `${kind}_chest_act${act}`;
    items[id] = { ...copy(items[`${kind}_chest`]), ItemID: id,
      DisplayName: `Act ${act} ${kind === "stage" ? "Stage" : "Boss"} Chest` };
  }
  return result;
}

export function makeLootboxConfig(current) {
  const result = copy(current);
  for (const act of [1, 2, 3]) for (const kind of ["stage", "boss"]) {
    const base = kind === "stage" ? "gear_summon" : "boss_summon";
    const id = act === 1 ? base : `${base}_act${act}`;
    const priceID = kind;
    const chestID = act === 1 ? `${kind}_chest` : `${kind}_chest_act${act}`;
    const definition = copy(current.Definitions[base]);
    definition.LootboxID = id;
    definition.PriceOptions = act === 1 ? copy(definition.PriceOptions) :
      { [priceID]: copy(definition.PriceOptions[priceID]) };
    definition.PriceOptions[priceID].Cost.Standard.Entries[0].ItemID = chestID;
    const percentages = rarityTables[`act${act}_${kind}`];
    definition.RewardSlots[0].Pool = gearRows.filter(row => percentages[rarities.indexOf(row.rarity)] > 0)
      .map(row => ({ Reward: { Standard: { Entries: [{ Type: "Item", Amount: 1,
        CatalogID: "Item", ItemID: row.id }] } },
      Weight: percentages[rarities.indexOf(row.rarity)] * 10 }));
    result.Definitions[id] = definition;
  }
  return result;
}
