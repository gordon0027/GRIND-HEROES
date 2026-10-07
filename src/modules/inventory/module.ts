import { defineModule, type Module } from "@idosgames/module-sdk";
import { makeInventoryScreen } from "./InventoryScreen";
import { t } from "./i18n";

// The inventory as a feature of the game. Always in the lobby (owner's decision 29.09.2026), even on a
// title without items yet — the screen then says so. Chests and keys hand off to the lootboxes system.
export const inventoryModule: Module = defineModule({
  id: "inventory",
  meta: { name: "Inventory", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "inventory",
      label: t("title"),
      icon: "box",
      group: "economy",
      order: 50,
      primary: true,
      Screen: makeInventoryScreen(ctx.features),
    });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "inventory" }),
      describeActions: {},
    });
  },
});
