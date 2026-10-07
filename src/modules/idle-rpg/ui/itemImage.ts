import type { GearItem } from "../game/equipment";
import { heroUi } from "./heroAssets";
import { gearIcon } from "./inventoryPresentation";

/** Inventory and chest rewards resolve the same final item art. */
export function gearImage(item: GearItem): string | null {
  const canonical = gearIcon(item);
  if (canonical) return `${import.meta.env.BASE_URL}${canonical}`;
  const ref = item.iconRef;
  if (!ref) return null;
  if (ref.startsWith("function_")) return heroUi.functionIcon(ref.replace(/\.png$/, ""));
  if (ref.startsWith("icon_")) return heroUi.itemIcon(ref.replace(/\.png$/, ""));
  return ref;
}
