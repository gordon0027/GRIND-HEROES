import type { ReactNode } from "react";
import { Icon, useCatalog, type ItemDefinitionView } from "@idosgames/react/ui";
import { EquipmentArt } from "../../shared/ui/EquipmentArt";
import { itemRarity } from "./itemPresentation";

export function MarketplaceItemArt({ itemID, size = 100 }: { itemID: string; size?: number }): ReactNode {
  const catalog = useCatalog();
  const def = catalog.items.get(itemID) as (ItemDefinitionView & { AssetPaths?: Record<string, string> | null }) | undefined;
  const icon = def?.AssetPaths?.icon;
  return <span className={`gh-market__art${size < 80 ? " gh-market__art--compact" : size > 120 ? " gh-market__art--large" : ""}`}>
    {icon
      ? <EquipmentArt icon={icon} rarity={itemRarity(def)} size={size} />
      : <Icon glyph={catalog.iconOf({ kind: "item", id: itemID, amount: 1 })} size={Math.round(size * .78)} />}
  </span>;
}
