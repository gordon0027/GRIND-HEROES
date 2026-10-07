import { createElement, useEffect } from "react";
import {
  defineModule,
  type FeatureRegistry,
  type Module,
} from "@idosgames/module-sdk";
import { useIDosGamesClient } from "@idosgames/react";
import { StoreScreen } from "./StoreScreen";
import { freeOffersWaiting, hasOffers } from "./model";
import { t } from "./i18n";

// The shop as a feature of the game (ctx.features): the lobby shows it as a main tab once the
// storefront has offers. Its badge counts free offers waiting to be taken (the daily gift), kept
// fresh by an invisible always-on panel — the screen itself is mounted only while open.
export const storeModule: Module = defineModule({
  id: "store",
  meta: { name: "Shop", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "store",
      label: t("title"),
      icon: "shop",
      group: "economy",
      order: 10,
      primary: true,
      available: false,
      Screen: StoreScreen,
    });
    ctx.registerPanel({
      id: "badge",
      slot: "modal",
      activeOnly: false,
      component: makeBadgeWatcher(ctx.features),
    });
    ctx.exposeToAgent({
      state: () => ({
        ui: "dom",
        feature: "store",
        badge: ctx.features.get("store")?.badge ?? 0,
      }),
      describeActions: {},
    });
  },
});

function makeBadgeWatcher(features: FeatureRegistry) {
  return function StoreBadge() {
    const client = useIDosGamesClient();
    useEffect(() => {
      const update = () => {
        const front = client.store.cachedStorefront;
        features.setAvailable(
          "store",
          hasOffers(front),
          "the storefront has no offers (Store section)",
        );
        features.setBadge("store", freeOffersWaiting(front));
      };
      void client.store.getStorefront().then(update);
      // The badge is counted from the STOREFRONT, and after a purchase the screen re-reads it: the
      // purchase's own state update comes before that, with the old storefront still cached — so the
      // gift just taken kept the badge lit until the next re-read here. Count again on every load.
      const offs = [
        client.on("user:anyUpdated", update),
        client.on("store:storefrontLoaded", update),
      ];
      // A free gift comes back with the next day: look again every few minutes.
      const id = setInterval(
        () => void client.store.getStorefront().then(update),
        5 * 60_000,
      );
      return () => {
        for (const off of offs) off();
        clearInterval(id);
      };
    }, [client]);
    return createElement("span", { hidden: true });
  };
}
