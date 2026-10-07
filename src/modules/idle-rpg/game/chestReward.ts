import { grantedBy } from "@idosgames/react/ui";
import { ownedGear, type GearDefinition, type GearItem } from "./equipment.ts";

/** The lootbox operation describes the awarded item even before inventory catches up. */
export function chestRewardItemID(operation: unknown): string | null {
  const rewards = grantedBy(operation as Parameters<typeof grantedBy>[0]);
  return rewards.find((reward) => reward.kind === "item")?.id ?? null;
}

export function newlyGrantedGear(items: readonly GearItem[], previousIDs: ReadonlySet<string>,
  rewardItemID: string | null): GearItem | null {
  const fresh = items.filter((item) => !previousIDs.has(item.instanceID));
  return rewardItemID ? fresh.find((item) => item.itemID === rewardItemID) ?? null : fresh[0] ?? null;
}

/** Display the authoritative roll if the inventory read is briefly stale. */
export function chestRewardPreview(itemID: string | null,
  definitions: ReadonlyMap<string, GearDefinition>): GearItem | null {
  if (!itemID) return null;
  return ownedGear({ "chest-reward-preview": { ItemID: itemID, CatalogID: "Item", Level: 1 } }, definitions)[0] ?? null;
}
