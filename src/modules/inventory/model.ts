// Pure helpers of the inventory screen — covered by model.test.ts.

import { rarityRank, type ItemDefinitionView } from "@idosgames/react/ui";

export interface InventoryView {
  Items?: Record<
    string,
    {
      StackableAmount?: number;
      UnstackableAmount?: number;
      TotalAmount?: number;
    } | null
  > | null;
  UnstackableItems?: Record<
    string,
    { ItemID?: string; Level?: number | null } | null
  > | null;
  VirtualCurrencies?: Record<string, { Amount?: number } | null> | null;
}

export interface OwnedItem {
  itemID: string;
  count: number;
  /** Instance ids of an unstackable item (equipment), best level first. */
  instances: Array<{ id: string; level: number }>;
}

/**
 * What the player owns: stackable counts plus the instances of unstackable items. Sorted rarest
 * first, then by id — a stable order, so the grid does not reshuffle when a count changes.
 */
export function ownedItems(
  inventory: InventoryView | null | undefined,
  definitions: Map<string, ItemDefinitionView>,
): OwnedItem[] {
  const owned = new Map<string, OwnedItem>();
  const get = (id: string): OwnedItem => {
    let o = owned.get(id);
    if (!o) owned.set(id, (o = { itemID: id, count: 0, instances: [] }));
    return o;
  };
  for (const [id, totals] of Object.entries(inventory?.Items ?? {})) {
    const total = Number(
      totals?.TotalAmount ??
        (totals?.StackableAmount ?? 0) + (totals?.UnstackableAmount ?? 0),
    );
    if (total > 0) get(id).count = total;
  }
  for (const [instanceID, instance] of Object.entries(
    inventory?.UnstackableItems ?? {},
  )) {
    if (!instance?.ItemID) continue;
    get(instance.ItemID).instances.push({
      id: instanceID,
      level: Number(instance.Level ?? 0),
    });
  }
  for (const o of owned.values()) {
    if (o.count < o.instances.length) o.count = o.instances.length;
    o.instances.sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));
  }
  return [...owned.values()]
    .filter((o) => o.count > 0)
    .sort((a, b) => {
      const r =
        rarityRank(definitions.get(a.itemID)?.Metadata?.RarityID) -
        rarityRank(definitions.get(b.itemID)?.Metadata?.RarityID);
      return r !== 0 ? r : a.itemID.localeCompare(b.itemID);
    });
}

export type Category = "all" | "equipment" | "consumable" | "other";

const EQUIPMENT = [
  "weapon",
  "sword",
  "armor",
  "shield",
  "helmet",
  "equipment",
  "gear",
  "ring",
  "boots",
  "amulet",
];
const CONSUMABLE = [
  "potion",
  "scroll",
  "consumable",
  "food",
  "booster",
  "key",
  "chest",
  "lootbox",
];

/** Category of an item by its class and tags (equipment = unstackable gear). */
export function categoryOf(
  def: ItemDefinitionView | undefined,
): Exclude<Category, "all"> {
  const words = [def?.ItemClass ?? "", ...(def?.Tags ?? [])].map((w) =>
    w.toLowerCase(),
  );
  if (words.some((w) => EQUIPMENT.includes(w))) return "equipment";
  if (words.some((w) => CONSUMABLE.includes(w))) return "consumable";
  if (def?.IsStackable === false) return "equipment";
  return "other";
}

/** A chest or a key: an item the chests screen (the lootboxes system) opens. */
export function isChestOrKey(def: ItemDefinitionView | undefined): boolean {
  return [def?.ItemClass ?? "", ...(def?.Tags ?? [])].some((w) =>
    ["chest", "lootbox", "key"].includes(w.toLowerCase()),
  );
}
