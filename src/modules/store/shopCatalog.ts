/** Provisional presentation catalogue for the future TOKEN checkout. No entry is buyable yet. */
export const SHOP_PAYMENT_CURRENCY = "TOKEN";

export type ShopCategory = "gems" | "chests";

export interface ShopProduct {
  id: string;
  category: ShopCategory;
  title: string;
  description: string;
  art: string;
  amount?: number;
  rarity?: "Rare" | "Epic" | "Legendary";
  provisionalTokenPrice: number;
  enabled: boolean;
  sortOrder: number;
  badge?: string;
  /** Display reference only; the future server order catalog must resolve fulfillment itself. */
  fulfillmentLootboxID?: string | null;
}

export const shopCatalog: readonly ShopProduct[] = [
  { id: "gems_small", category: "gems", title: "Small Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", amount: 500, provisionalTokenPrice: 5, enabled: true, sortOrder: 10 },
  { id: "gems_medium", category: "gems", title: "Medium Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", amount: 1200, provisionalTokenPrice: 12, enabled: true, sortOrder: 20 },
  { id: "gems_large", category: "gems", title: "Large Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", amount: 3000, provisionalTokenPrice: 30, enabled: true, sortOrder: 30 },
  { id: "chest_rare", category: "chests", title: "Rare Chest", description: "Concept only. No separate loot table is configured.", art: "assets/ui/chests/stage_chest.png", rarity: "Rare", provisionalTokenPrice: 10, enabled: false, sortOrder: 10, fulfillmentLootboxID: null },
  { id: "premium_chest_v1", category: "chests", title: "Premium Chest", description: "Contains one Rare, Epic or Legendary equipment item. The server rolls the reward.", art: "assets/ui/chests/Epic Purple Enchanted Treasure Chest.png", provisionalTokenPrice: 20, enabled: true, sortOrder: 20, fulfillmentLootboxID: "premium_equipment_v1" },
  { id: "chest_legendary", category: "chests", title: "Legendary Chest", description: "Concept only. No separate loot table is configured.", art: "assets/ui/chests/boss_chest.png", rarity: "Legendary", provisionalTokenPrice: 35, enabled: false, sortOrder: 30, fulfillmentLootboxID: null },
];

export function visibleProducts(category: ShopCategory): ShopProduct[] {
  return shopCatalog.filter((product) => product.enabled && product.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
