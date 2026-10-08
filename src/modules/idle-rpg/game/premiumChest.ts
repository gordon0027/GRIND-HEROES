import { newlyGrantedGear } from "./chestReward.ts";
import type { GearItem } from "./equipment.ts";

export const PREMIUM_CHEST_ITEM_ID = "premium_chest_v1";
export const PREMIUM_LOOTBOX_ID = "premium_equipment_v1";
export const PREMIUM_OPTION_ID = "chest";

export interface PremiumLootboxDefinition {
  Definitions?: Record<string, { PriceOptions?: Record<string, {
    Cost?: { Standard?: { Entries?: Array<{ Type?: string; CatalogID?: string; ItemID?: string; Amount?: number }> } };
  }> }>;
}

export function hasPremiumOption(definition: PremiumLootboxDefinition | null | undefined): boolean {
  const entries = definition?.Definitions?.[PREMIUM_LOOTBOX_ID]?.PriceOptions?.[PREMIUM_OPTION_ID]?.Cost?.Standard?.Entries;
  return entries?.length === 1 && entries[0]?.Type === "Item" && entries[0]?.CatalogID === "Item" &&
    entries[0]?.ItemID === PREMIUM_CHEST_ITEM_ID && entries[0]?.Amount === 1;
}

export function premiumChestCount(inventory: {
  Items?: Record<string, { StackableAmount?: number; TotalAmount?: number } | null> | null;
} | null | undefined): number {
  const chest = inventory?.Items?.[PREMIUM_CHEST_ITEM_ID];
  return Math.max(0, Number(chest?.StackableAmount ?? chest?.TotalAmount ?? 0));
}

/** A ref-owned gate must reject a second click before React has rendered its disabled button. */
export function createPremiumOpenGate() {
  let pending = false;
  return {
    isPending: () => pending,
    async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
      if (pending) return undefined;
      pending = true;
      try { return await operation(); }
      finally { pending = false; }
    },
  };
}

export function premiumRewardInInventory(items: readonly GearItem[], previousIDs: ReadonlySet<string>,
  rewardItemID: string | null): GearItem | null {
  return newlyGrantedGear(items, previousIDs, rewardItemID);
}

/** Confirm both halves of the server operation before offering CONTINUE. */
export async function waitForPremiumReward(options: {
  read: () => Promise<boolean>;
  items: () => readonly GearItem[];
  count: () => number;
  previousIDs: ReadonlySet<string>;
  previousCount: number;
  rewardItemID: string | null;
  attempts?: number;
  delay?: (milliseconds: number) => Promise<void>;
}): Promise<GearItem | null> {
  const attempts = options.attempts ?? 5;
  const delay = options.delay ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      if (await options.read()) {
        const item = premiumRewardInInventory(options.items(), options.previousIDs, options.rewardItemID);
        if (item && options.count() <= options.previousCount - 1) return item;
      }
    } catch { /* A later read may succeed after a transient network error. */ }
    if (attempt + 1 < attempts) await delay(200 * (attempt + 1));
  }
  return null;
}
