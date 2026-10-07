import { createElement, useEffect } from "react";
import {
  defineModule,
  type FeatureRegistry,
  type Module,
} from "@idosgames/module-sdk";
import { useIDosGamesClient } from "@idosgames/react";
import { configSection } from "@idosgames/react/ui";
import { makeMarketplaceScreen } from "./MarketplaceScreen";
import { hasTitleData, marketplaceBadge } from "./model";
import { t } from "./i18n";

// The marketplace as a feature of the game. Badge: things to claim (won lots, expired escrow) and
// incoming trades waiting for an answer — read once at start and after every marketplace action.
export const marketplaceModule: Module = defineModule({
  id: "marketplace",
  meta: { name: "Marketplace", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "marketplace",
      label: t("title"),
      icon: "market",
      group: "economy",
      order: 70,
      available: false,
      Screen: makeMarketplaceScreen(ctx.features),
    });
    const decide = () =>
      ctx.features.setAvailable(
        "marketplace",
        hasTitleData(
          configSection<{ Enabled?: boolean | null }>(
            ctx.client,
            "Marketplace",
          ),
        ),
        "the marketplace is not set up on the title, or switched off",
      );
    decide();
    // The engine does not put Marketplace into the client's title config: read it once with its own
    // call (it lands in the same config section). Without this the tab never showed on any title.
    if (!configSection(ctx.client, "Marketplace"))
      void ctx.client.marketplace.getDefinitions().then(decide);
    ctx.registerPanel({
      id: "badge",
      slot: "modal",
      activeOnly: false,
      component: makeBadgeWatcher(ctx.features),
    });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "marketplace" }),
      describeActions: {},
    });
  },
});

function makeBadgeWatcher(features: FeatureRegistry) {
  return function MarketplaceBadge() {
    const client = useIDosGamesClient();
    useEffect(() => {
      // A title without the section has no marketplace — no request at all. The section arrives by
      // its own call (module setup), so the watcher starts once the definitions are in.
      let id: ReturnType<typeof setInterval> | null = null;
      const check = () =>
        void client.marketplace
          .getMyState()
          .then(
            (res) =>
              res.ok &&
              features.setBadge("marketplace", marketplaceBadge(res.data)),
          );
      const start = () => {
        if (id || !hasTitleData(configSection(client, "Marketplace"))) return;
        check();
        id = setInterval(check, 5 * 60_000);
      };
      start();
      const off = client.on("marketplace:definitionsLoaded", start);
      return () => {
        off();
        if (id) clearInterval(id);
      };
    }, [client]);
    return createElement("span", { hidden: true });
  };
}
