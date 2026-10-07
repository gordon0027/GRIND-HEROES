import { defineModule, type Module } from "@idosgames/module-sdk";
import { configSection } from "@idosgames/react/ui";
import { QuestsScreen, makeQuestsWatcher } from "./QuestsScreen";
import { hasTitleData, type QuestSection } from "./model";
import { t } from "./i18n";

// Quests as a feature of the game: cycles as tabs, the quest points track, claim all. The watcher
// keeps the badge (finished quests) — only on a title with quests.
export const questsModule: Module = defineModule({
  id: "quests",
  meta: { name: "Quests", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "quests",
      label: t("title"),
      icon: "quest",
      group: "events",
      order: 41,
      primary: true,
      available: false,
      Screen: QuestsScreen,
    });
    const enabled = hasTitleData(
      configSection<QuestSection>(ctx.client, "Quest"),
    );
    ctx.features.setAvailable(
      "quests",
      enabled,
      "no quests on the title (Quest)",
    );
    if (enabled)
      ctx.registerPanel({
        id: "badge",
        slot: "modal",
        activeOnly: false,
        component: makeQuestsWatcher(ctx.features),
      });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "quests" }),
      describeActions: {},
    });
  },
});
