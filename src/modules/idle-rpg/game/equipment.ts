import { curveMultiplier, type ScalarCurveSpec } from "@idosgames/core";
import type { FighterStats } from "./heroStats";
import type { HeroSource } from "./stageRun";

export const GEAR_SLOTS = ["Helmet", "Armor", "Gloves", "Boots", "Weapon", "Offhand"] as const;
export type GearSlot = typeof GEAR_SLOTS[number];
export const GEAR_STATS = ["Attack", "Max HP", "Defence", "Attack Speed", "Move Speed"] as const;
export type GearStat = typeof GEAR_STATS[number];
export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export const RARITY_LEVELS: Record<Rarity, number> = {
  Common: 1, Uncommon: 5, Rare: 10, Epic: 15, Legendary: 20,
};

export interface GearBonuses { attack: number; maxHp: number; defence: number; attackSpeed: number; moveSpeed: number }
export const ZERO_BONUSES: GearBonuses = { attack: 0, maxHp: 0, defence: 0, attackSpeed: 0, moveSpeed: 0 };

export interface GearDefinition {
  ItemID?: string;
  DisplayName?: string;
  AssetPaths?: Record<string, string> | null;
  Metadata?: { RarityID?: string | null } | null;
  Stats?: { FlatBonuses?: Record<string, number> | null } | null;
  Equipment?: { AllowedSlotIDs?: string[] | null; AllowedCharacterIDs?: string[] | null } | null;
  Upgrade?: { FlatBonusCurve?: ScalarCurveSpec | null } | null;
}

export interface GearInstance {
  ItemID?: string;
  CatalogID?: string | null;
  Level?: number | null;
  EquippedSlot?: { CharacterID?: string | null; SlotID?: string | null } | null;
}

export interface GearItem {
  instanceID: string;
  itemID: string;
  catalogID: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  requiredLevel: number;
  level: number;
  bonuses: GearBonuses;
  allowedHeroes: string[];
  iconRef: string | null;
  equippedBy: { heroID: string; slot: GearSlot } | null;
}

const RARITIES = new Set<string>(["Common", "Uncommon", "Rare", "Epic", "Legendary"]);
const isGearSlot = (value: string): value is GearSlot => (GEAR_SLOTS as readonly string[]).includes(value);

export function gearBonuses(def: GearDefinition, level = 1): GearBonuses {
  const flat = def.Stats?.FlatBonuses ?? {};
  const scale = curveMultiplier(def.Upgrade?.FlatBonusCurve, Math.max(1, level), 1);
  const value = (...keys: string[]) => keys.reduce((sum, key) => sum + Number(flat[key] ?? 0), 0) * scale;
  return {
    attack: value("Damage", "Attack"), maxHp: value("Health", "HP", "MaxHp"),
    defence: value("Armor", "Defense", "Defence"), attackSpeed: value("AttackSpeed"),
    moveSpeed: value("MoveSpeed"),
  };
}

/** Normalize iDos item definitions and authoritative InventoryV2 instances once for the UI/run. */
export function ownedGear(
  instances: Record<string, GearInstance | null> | null | undefined,
  definitions: ReadonlyMap<string, GearDefinition>,
): GearItem[] {
  const result: GearItem[] = [];
  for (const [instanceID, instance] of Object.entries(instances ?? {})) {
    if (!instance?.ItemID) continue;
    const def = definitions.get(instance.ItemID);
    const slot = def?.Equipment?.AllowedSlotIDs?.find(isGearSlot);
    if (!def || !slot) continue;
    const rarityID = def.Metadata?.RarityID ?? "Common";
    const worn = instance.EquippedSlot;
    const rarity = (RARITIES.has(rarityID) ? rarityID : "Common") as Rarity;
    result.push({
      instanceID, itemID: instance.ItemID, catalogID: instance.CatalogID ?? "Item",
      name: def.DisplayName || instance.ItemID, slot,
      rarity,
      requiredLevel: RARITY_LEVELS[rarity],
      level: Math.max(1, Number(instance.Level ?? 1)),
      bonuses: gearBonuses(def, Number(instance.Level ?? 1)),
      allowedHeroes: [...(def.Equipment?.AllowedCharacterIDs ?? [])],
      iconRef: def.AssetPaths?.icon ?? null,
      equippedBy: worn?.CharacterID && worn.SlotID && isGearSlot(worn.SlotID)
        ? { heroID: worn.CharacterID, slot: worn.SlotID } : null,
    });
  }
  return result.sort((a, b) => GEAR_SLOTS.indexOf(a.slot) - GEAR_SLOTS.indexOf(b.slot)
    || a.name.localeCompare(b.name) || a.instanceID.localeCompare(b.instanceID));
}

export function equipProblems(item: GearItem, heroID: string, heroLevel: number, unlocked: boolean,
  heroSlots: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  if (!unlocked) problems.push("Hero is locked");
  if (!heroSlots.has(item.slot)) problems.push(`No ${item.slot} slot`);
  if (!gearAllowsHero(item, heroID)) problems.push(`Requires ${item.allowedHeroes.join(" / ")}`);
  if (heroLevel < item.requiredLevel) problems.push(`Requires Lv ${item.requiredLevel}`);
  if (item.equippedBy && item.equippedBy.heroID !== heroID)
    problems.push(`Equipped by ${item.equippedBy.heroID}`);
  if (item.equippedBy?.heroID === heroID) problems.push("Already equipped");
  return problems;
}

export function equipProblem(item: GearItem, heroID: string, heroLevel: number, unlocked: boolean,
  heroSlots: ReadonlySet<string>): string | null {
  return equipProblems(item, heroID, heroLevel, unlocked, heroSlots).join(" · ") || null;
}

/** An empty AllowedCharacterIDs list is universal. */
export function gearAllowsHero(item: GearItem, heroID: string): boolean {
  return item.allowedHeroes.length === 0 || item.allowedHeroes.includes(heroID);
}

export function equippedIn(items: readonly GearItem[], heroID: string, slot: GearSlot): GearItem | null {
  return items.find((item) => item.equippedBy?.heroID === heroID && item.equippedBy.slot === slot) ?? null;
}

/** The player-wide bag contains only unassigned instances, regardless of who is selected. */
export function availableGear(items: readonly GearItem[]): GearItem[] {
  return items.filter((item) => !item.equippedBy);
}

export function totalBonuses(items: readonly GearItem[], heroID: string): GearBonuses {
  return items.filter((item) => item.equippedBy?.heroID === heroID).reduce((sum, item) => ({
    attack: sum.attack + item.bonuses.attack, maxHp: sum.maxHp + item.bonuses.maxHp,
    defence: sum.defence + item.bonuses.defence,
    attackSpeed: sum.attackSpeed + item.bonuses.attackSpeed,
    moveSpeed: sum.moveSpeed + item.bonuses.moveSpeed,
  }), { ...ZERO_BONUSES });
}

export function compareGear(candidate: GearItem, current: GearItem | null): GearBonuses {
  const old = current?.bonuses ?? ZERO_BONUSES;
  return {
    attack: candidate.bonuses.attack - old.attack,
    maxHp: candidate.bonuses.maxHp - old.maxHp,
    defence: candidate.bonuses.defence - old.defence,
    attackSpeed: candidate.bonuses.attackSpeed - old.attackSpeed,
    moveSpeed: candidate.bonuses.moveSpeed - old.moveSpeed,
  };
}

/** One stage-stat pipeline: server character base + equipped iDos item flats + local archetype. */
export function stageHeroStats(base: FighterStats, archetype: {
  moveSpeed: number; attackRange: number; cadence: number; hit: number;
}, gear: GearBonuses): Pick<HeroSource, "maxHp" | "attack" | "defence" | "attackSpeed" | "moveSpeed" | "attackRange"> {
  return {
    maxHp: Math.max(1, base.maxHp + gear.maxHp),
    attack: Math.max(1, (base.damage + gear.attack) * archetype.hit),
    defence: Math.max(0, base.armor + gear.defence),
    attackSpeed: Math.max(0.1, (base.attackSpeed + gear.attackSpeed) * archetype.cadence),
    moveSpeed: Math.max(1, archetype.moveSpeed + gear.moveSpeed),
    attackRange: archetype.attackRange,
  };
}

/** Display-only Grind Heroes combat power; iDos Character.Power remains server-owned. */
export function combatPower(stats: Pick<HeroSource, "maxHp" | "attack" | "defence" | "attackSpeed" | "moveSpeed">): number {
  return Math.round(stats.attack * 2 + stats.maxHp / 10 + stats.defence * 3
    + stats.attackSpeed * 20 + stats.moveSpeed / 5);
}
