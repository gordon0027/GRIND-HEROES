import { defineModule, type Module } from "@idosgames/module-sdk";
import { configSection } from "@idosgames/react/ui";
import { LootboxesScreen, makeLootboxesWatcher } from "./LootboxesScreen";
import { hasTitleData, type LootboxSection } from "./model";
import { t } from "./i18n";

// Chests as a feature of the game. The inventory hands a chest or key item over here
// (features.open("lootboxes", { itemID })). Badge: chests the player can open right now with the
// items they hold — read from the cached inventory, no request of its own.
export const lootboxesModule: Module = defineModule({
  id: "lootboxes",
  meta: { name: "Chests", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "lootboxes",
      label: t("title"),
      icon: "chest",
      group: "economy",
      order: 55,
      available: false,
      Screen: LootboxesScreen,
    });
    const enabled = hasTitleData(
      configSection<LootboxSection>(ctx.client, "Lootbox"),
    );
    ctx.features.setAvailable(
      "lootboxes",
      enabled,
      "no lootboxes on the title (Lootbox)",
    );
    if (enabled)
      ctx.registerPanel({
        id: "badge",
        slot: "modal",
        activeOnly: false,
        component: makeLootboxesWatcher(ctx.features),
      });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "lootboxes" }),
      describeActions: {},
    });
  },
});
