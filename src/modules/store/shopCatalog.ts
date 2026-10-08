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
  /** Null until a server-owned premium loot table is configured. */
  fulfillmentLootboxID?: string | null;
}

export const shopCatalog: readonly ShopProduct[] = [
  { id: "gems_small", category: "gems", title: "Small Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", amount: 500, provisionalTokenPrice: 5, enabled: true, sortOrder: 10 },
  { id: "gems_medium", category: "gems", title: "Medium Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", amount: 1200, provisionalTokenPrice: 12, enabled: true, sortOrder: 20 },
  { id: "gems_large", category: "gems", title: "Large Gem Pack", description: "GEMS for equipment trading in the Marketplace.", art: "assets/ui/source/Component/UI_Etc/status_icon_gem.png", amount: 3000, provisionalTokenPrice: 30, enabled: true, sortOrder: 30 },
  { id: "chest_rare", category: "chests", title: "Rare Chest", description: "Premium equipment chest. Contents will be defined by a server loot table.", art: "assets/ui/chests/stage_chest.png", rarity: "Rare", provisionalTokenPrice: 10, enabled: true, sortOrder: 10, fulfillmentLootboxID: null },
  { id: "chest_epic", category: "chests", title: "Epic Chest", description: "Premium equipment chest. Contents will be defined by a server loot table.", art: "assets/ui/chests/Epic Purple Enchanted Treasure Chest.png", rarity: "Epic", provisionalTokenPrice: 20, enabled: true, sortOrder: 20, fulfillmentLootboxID: null },
  { id: "chest_legendary", category: "chests", title: "Legendary Chest", description: "Premium equipment chest. Contents will be defined by a server loot table.", art: "assets/ui/chests/boss_chest.png", rarity: "Legendary", provisionalTokenPrice: 35, enabled: true, sortOrder: 30, fulfillmentLootboxID: null },
];

export function visibleProducts(category: ShopCategory): ShopProduct[] {
  return shopCatalog.filter((product) => product.enabled && product.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
