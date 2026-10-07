import { makeT } from "@idosgames/react/ui";

const EN = {
  title: "Inventory",
  all: "All",
  equipment: "Equipment",
  consumable: "Consumables",
  other: "Other",
  empty: "Nothing here yet — buy something in the shop.",
  noItems: "Items are not configured. Add them in LiveOps → Items.",
  rarity: "Rarity",
  quantity: "Quantity",
  level: "Level",
  equip: "Equip",
  open: "Open",
  toShop: "To the shop",
} as const;

export const t = makeT<keyof typeof EN>(EN, {
  title: "Инвентарь",
  all: "Все",
  equipment: "Снаряжение",
  consumable: "Расходники",
  other: "Разное",
  empty: "Пока пусто — купите что-нибудь в магазине.",
  noItems: "Предметы не настроены. Добавьте их в LiveOps → Items.",
  rarity: "Редкость",
  quantity: "Количество",
  level: "Уровень",
  equip: "Надеть",
  open: "Открыть",
  toShop: "В магазин",
});
