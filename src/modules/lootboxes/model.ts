// Pure helpers of the chests screen — covered by model.test.ts.

import { costLines, type ResourceLine } from "@idosgames/react/ui";

export interface LootboxView {
  LootboxID?: string;
  AssetPaths?: Record<string, string> | null;
  PriceOptions?: Record<
    string,
    { OptionID?: string | null; Name?: string | null; Cost?: unknown } | null
  > | null;
  MaxOpenCount?: number | null;
}

/** The title's Lootbox section, as far as the chests screen cares. */
export interface LootboxSection {
  Definitions?: Record<string, LootboxView | null> | null;
  Settings?: { MaxOpenCount?: number | null } | null;
}

/** What the player holds, as far as paying for a chest goes. */
export interface InventoryView {
  Items?: Record<
    string,
    { StackableAmount?: number; TotalAmount?: number } | null
  > | null;
  VirtualCurrencies?: Record<string, { Amount?: number } | null> | null;
}

export interface LootboxOption {
  lootboxID: string;
  optionID: string;
  name: string | null;
  icon: string;
  price: ResourceLine[];
  /** Most boxes one open() may take (the server clamps a bigger count to it). */
  maxOpen: number;
}

/** The platform's ceiling when neither the lootbox nor the module sets one. */
const DEFAULT_MAX_OPEN = 100;

/**
 * A lootbox has no display name of its own in the engine — only its id. Shown as is, the player read
 * "wooden_chest"; this makes the id readable ("Wooden chest") when the title has no translation for it.
 */
export function lootboxName(
  id: string,
  localize: (text: string) => string,
): string {
  const translated = localize(id);
  if (translated && translated !== id) return translated;
  const words = id.replace(/[_-]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : id;
}

/** Every way to open every lootbox of the title (one entry per price option). */
export function lootboxOptions(
  section: LootboxSection | null | undefined,
): LootboxOption[] {
  const out: LootboxOption[] = [];
  for (const [id, def] of Object.entries(section?.Definitions ?? {})) {
    if (!def) continue;
    const maxOpen = Number(
      def.MaxOpenCount ?? section?.Settings?.MaxOpenCount ?? DEFAULT_MAX_OPEN,
    );
    if (maxOpen <= 0) continue;
    for (const [optionID, option] of Object.entries(def.PriceOptions ?? {})) {
      if (!option) continue;
      out.push({
        lootboxID: def.LootboxID ?? id,
        optionID: option.OptionID || optionID,
        name: option.Name ?? null,
        icon: def.AssetPaths?.icon ?? "chest",
        price: costLines(option.Cost as never),
        maxOpen,
      });
    }
  }
  return out.sort(
    (a, b) =>
      a.lootboxID.localeCompare(b.lootboxID) ||
      a.optionID.localeCompare(b.optionID),
  );
}

/** Lootboxes an item opens: options whose price consumes that item (a chest or a key). */
export function lootboxesOpenedBy(
  itemID: string,
  options: LootboxOption[],
): LootboxOption[] {
  return options.filter((o) =>
    o.price.some((line) => line.kind === "item" && line.id === itemID),
  );
}

/** Whether the player holds what `times` openings of an option cost (currencies and items). */
export function canPay(
  option: LootboxOption,
  inventory: InventoryView | null | undefined,
  times = 1,
): boolean {
  return option.price.every((line) => {
    const need = line.amount * times;
    if (line.kind === "currency")
      return (
        Number(inventory?.VirtualCurrencies?.[line.id]?.Amount ?? 0) >= need
      );
    if (line.kind === "item")
      return (
        Number(
          inventory?.Items?.[line.id]?.TotalAmount ??
            inventory?.Items?.[line.id]?.StackableAmount ??
            0,
        ) >= need
      );
    return true;
  });
}

/** The bulk opening offered next to a single one: ten boxes, when the ceiling and the wallet allow. */
export const BULK = 10;
export function canOpenBulk(
  option: LootboxOption,
  inventory: InventoryView | null | undefined,
): boolean {
  return option.maxOpen >= BULK && canPay(option, inventory, BULK);
}

/** Badge: lootboxes the player can open right now with items (chests, keys) — not with currency. */
export function openableWithItems(
  options: LootboxOption[],
  inventory: InventoryView | null | undefined,
): number {
  return options.filter(
    (o) => o.price.some((l) => l.kind === "item") && canPay(o, inventory),
  ).length;
}

/** Whether the title has lootboxes — until it does, the lobby hides the tab. */
export function hasTitleData(section: LootboxSection | undefined): boolean {
  return lootboxOptions(section).length > 0;
}
