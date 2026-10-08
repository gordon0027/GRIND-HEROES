/** Presentation only. Prices and rewards come from the server catalog. */

export type ShopCategory = "gems" | "chests";

export interface ShopProduct {
  id: string;
  category: ShopCategory;
  title: string;
  description: string;
  art: string;
  rarity?: "Rare" | "Epic" | "Legendary";
  enabled: boolean;
  sortOrder: number;
  badge?: string;
}

export const shopCatalog: readonly ShopProduct[] = [
  { id: "gems_small", category: "gems", title: "Small Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", enabled: true, sortOrder: 10 },
  { id: "gems_medium", category: "gems", title: "Medium Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", enabled: true, sortOrder: 20 },
  { id: "gems_large", category: "gems", title: "Large Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", enabled: true, sortOrder: 30 },
  { id: "chest_rare", category: "chests", title: "Rare Chest", description: "Concept only. No separate loot table is configured.", art: "assets/ui/chests/stage_chest.png", rarity: "Rare", enabled: false, sortOrder: 10 },
  { id: "premium_chest_v1", category: "chests", title: "Premium Chest", description: "Contains one Rare, Epic or Legendary equipment item. The server rolls the reward.", art: "assets/ui/chests/Epic Purple Enchanted Treasure Chest.png", enabled: true, sortOrder: 20 },
  { id: "chest_legendary", category: "chests", title: "Legendary Chest", description: "Concept only. No separate loot table is configured.", art: "assets/ui/chests/boss_chest.png", rarity: "Legendary", enabled: false, sortOrder: 30 },
];

export function visibleProducts(category: ShopCategory): ShopProduct[] {
  return shopCatalog.filter((product) => product.enabled && product.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
