import type { GearItem, GearSlot, Rarity } from "../game/equipment";

type IconName = string;
type Family = "sword" | "shield" | "helmet" | "armor" | "gloves" | "boots" |
  "bow" | "quiver" | "staff" | "orb";

/** Tier order is Common, Uncommon, Rare, Epic, Legendary. These are local final art files. */
export const EQUIPMENT_ICON_TIERS: Record<Family, readonly [string, string, string, string, string]> = {
  sword: ["wooden_sword", "bronze_sword", "iron_sword", "runeblade", "dragon_blade"],
  shield: ["oak_shield", "reinforced_shield", "steel_bulwark", "runic_aegis", "sunforge_aegis"],
  helmet: ["leather_helmet", "reinforced_helmet", "steel_helmet", "runic_helm", "phoenix_helm"],
  armor: ["leather_vest", "reinforced_vest", "chainmail", "knight_plate", "dragon_scale"],
  gloves: ["worn_gloves", "training_gloves", "steel_gauntlets", "runebound_gloves", "titan_gauntlets"],
  boots: ["traveler_boots", "scout_boots", "swift_boots", "windwalker_boots", "stormstride_boots"],
  bow: ["hunter_bow", "recurve_bow", "silverwood_bow", "moonweave_bow", "starfall_bow"],
  quiver: ["field_quiver", "arrow_quiver", "steelhead_quiver", "stormshot_quiver", "dragonflight_quiver"],
  staff: ["apprentice_staff", "ashwood_staff", "crystal_staff", "sapphire_staff", "astral_staff"],
  orb: ["apprentice_orb", "focus_orb", "sapphire_orb", "runic_orb", "celestial_orb"],
};

const universalIcons: Record<Exclude<GearSlot, "Weapon" | "Offhand">, IconName> = {
  Helmet: "icon_equip_helmet_0", Armor: "icon_equip_armor",
  Gloves: "icon_equip_hand", Boots: "icon_equip_shoes",
};
const knightIcons = { Weapon: "icon_equip_sword", Offhand: "icon_equip_shield" };
const classIcons: Record<string, Record<"Weapon" | "Offhand", IconName>> = {
  Knight: knightIcons,
  Archer: { Weapon: "icon_equip_arrow", Offhand: "icon_equip_arrows" },
  Mage: { Weapon: "function_icon_wand", Offhand: "function_icon_magicball" },
};
const knightFamilies: Record<"Weapon" | "Offhand", Family> = { Weapon: "sword", Offhand: "shield" };
const classFamilies: Record<string, Record<"Weapon" | "Offhand", Family>> = {
  Knight: knightFamilies,
  Archer: { Weapon: "bow", Offhand: "quiver" },
  Mage: { Weapon: "staff", Offhand: "orb" },
};
const rarityIndex: Record<Rarity, number> = {
  Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4,
};
export const rarityColors: Record<Rarity, string> = {
  Common: "#c5c1b9", Uncommon: "#83c87d", Rare: "#66b3ed", Epic: "#ba83ee", Legendary: "#f8c461",
};
const itemFamilies = new Map<string, Family>(Object.entries(EQUIPMENT_ICON_TIERS)
  .flatMap(([family, names]) => names.map((name) => [name, family as Family] as const)));

export function inventoryHero(heroes: readonly { id: string; rank: number }[], preferredID: string | null): string | null {
  return heroes.find((hero) => hero.id === preferredID && hero.rank > 0)?.id ??
    heroes.find((hero) => hero.rank > 0)?.id ?? null;
}

export function emptySlotIcon(slot: GearSlot, heroID: string): IconName {
  if (slot !== "Weapon" && slot !== "Offhand") return universalIcons[slot];
  return (classIcons[heroID] ?? knightIcons)[slot];
}

/** Item identity wins over the viewed hero. An unknown ID uses its family and rarity. */
export function gearIcon(item: GearItem): string | null {
  let family = itemFamilies.get(item.itemID);
  if (!family && item.slot !== "Weapon" && item.slot !== "Offhand")
    family = item.slot.toLowerCase() as Family;
  if (!family && (item.slot === "Weapon" || item.slot === "Offhand")) {
    const requiredHero = item.allowedHeroes.find((id) => classFamilies[id]);
    family = (classFamilies[requiredHero ?? "Knight"] ?? knightFamilies)[item.slot];
  }
  if (!family) return null;
  const name = itemFamilies.has(item.itemID)
    ? item.itemID : EQUIPMENT_ICON_TIERS[family][rarityIndex[item.rarity]];
  return `assets/ui/icons/${family}/${name}.png`;
}

