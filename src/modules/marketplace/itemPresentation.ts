import { curveMultiplier, type ItemDefinition, type MarketplaceOfferView } from "@idosgames/core";

type ItemPresentationDefinition = Pick<ItemDefinition, "Equipment" | "Metadata" | "Stats" | "Upgrade" | "ItemClass">;

export const GRIND_SLOTS = ["Helmet", "Armor", "Gloves", "Boots", "Weapon", "Offhand"] as const;
export const GRIND_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
export const GRIND_REQUIRED_LEVEL: Record<string, number> = {
  Common: 1, Uncommon: 5, Rare: 10, Epic: 15, Legendary: 20,
};

const statNames: Record<string, string> = {
  Damage: "Attack", Attack: "Attack", Health: "Max HP", HP: "Max HP", MaxHp: "Max HP",
  Armor: "Defence", Defense: "Defence", Defence: "Defence",
  AttackSpeed: "Attack Speed", MoveSpeed: "Move Speed",
  CritChance: "Crit Chance", CritDamage: "Crit Damage",
};

export function itemSlot(def: ItemPresentationDefinition | null | undefined): string | null {
  return def?.Equipment?.AllowedSlotIDs?.find((id) => (GRIND_SLOTS as readonly string[]).includes(id)) ?? null;
}

export function itemRarity(def: ItemPresentationDefinition | null | undefined): string {
  return def?.Metadata?.RarityID || "Common";
}

export function offerLevel(offer: MarketplaceOfferView): number {
  return Math.max(1, Number(offer.GoodsInstances?.[0]?.Level ?? 1));
}

export function itemStatLines(def: ItemPresentationDefinition | null | undefined, level = 1): string[] {
  if (!def) return [];
  const scale = curveMultiplier(def.Upgrade?.FlatBonusCurve, Math.max(1, level), 1);
  const flat = Object.entries(def.Stats?.FlatBonuses ?? {}).filter(([, value]) => Number(value) !== 0)
    .map(([id, value]) => {
      const scaled = Number(value) * scale;
      return `+${Number(scaled.toFixed(2)).toLocaleString("en-US")} ${statNames[id] ?? id}`;
    });
  const percent = Object.entries(def.Stats?.PercentBonuses ?? {}).filter(([, value]) => Number(value) !== 0)
    .map(([id, value]) => `+${Number((Number(value) * 100).toFixed(2))}% ${statNames[id] ?? id}`);
  return [...flat, ...percent];
}
