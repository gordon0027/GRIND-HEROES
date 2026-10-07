import { createElement, useEffect } from "react";
import {
  defineModule,
  type FeatureRegistry,
  type Module,
} from "@idosgames/module-sdk";
import { useIDosGamesClient } from "@idosgames/react";
import {
  canAfford,
  configSection,
  itemDefinitions,
  type ItemSection,
} from "@idosgames/react/ui";
import { makeCharacterScreen } from "./CharacterScreen";
import {
  bestLoadout,
  gearPieces,
  hasTitleData,
  heroesBadge,
  resolveLadder,
  resolveSlots,
  roster,
  type CharacterModelView,
  type CharacterSection,
  type InstanceView,
  type ItemDefWithGear,
} from "./model";
import { t } from "./i18n";
import { heroSelected } from "./events";
import { readSelected, resolveSelected } from "./selection";

// Heroes as a feature of the game (the Hero button of the Unity project). The badge counts heroes
// that can be unlocked or ranked up right now, plus "better gear is available". The hero the player
// plays with goes out as `character:hero-selected@1` — once the roster is known, and on every pick.
export const characterModule: Module = defineModule({
  id: "character",
  meta: { name: "Heroes", type: "app", engine: "dom" },
  setup(ctx) {
    let announced: string | null = null;
    const announce = (characterId: string | undefined) => {
      if (!characterId || characterId === announced) return;
      announced = characterId;
      ctx.events.emit(heroSelected, { characterId });
    };

    ctx.features.register({
      id: "character",
      label: t("title"),
      icon: "hero",
      group: "economy",
      order: 20,
      primary: true,
      available: false,
      Screen: makeCharacterScreen(ctx.features, announce),
    });
    ctx.features.setAvailable(
      "character",
      hasTitleData(configSection<CharacterSection>(ctx.client, "Character")),
      "no heroes on the title (Character definitions are empty)",
    );
    ctx.registerPanel({
      id: "badge",
      slot: "modal",
      activeOnly: false,
      component: makeBadgeWatcher(ctx.features, announce),
    });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "character", selected: announced }),
      describeActions: {},
    });
  },
});

function makeBadgeWatcher(
  features: FeatureRegistry,
  announce: (characterId: string | undefined) => void,
) {
  return function HeroesBadge() {
    const client = useIDosGamesClient();
    useEffect(() => {
      const update = () => {
        const section = configSection<CharacterSection>(client, "Character");
        if (!section) return features.setBadge("character", 0);
        const state = client.data.user.state;
        const owned = (state?.Character?.Characters ?? {}) as Record<
          string,
          CharacterModelView
        >;
        const balances = state?.InventoryV2?.VirtualCurrencies as
          Record<string, { Amount?: number }> | undefined;
        const items = itemDefinitions(
          configSection<ItemSection>(client, "Item"),
        ) as Map<string, ItemDefWithGear>;
        const pieces = gearPieces(
          (
            state?.InventoryV2 as
              | { UnstackableItems?: Record<string, InstanceView | null> }
              | undefined
          )?.UnstackableItems,
          items,
        );
        const list = roster(section, owned);
        // The saved hero (or the first playable one) as soon as the roster is known — the game
        // fields it from the first frame. Re-resolved on every update: a hero that just became
        // playable may now be the answer.
        announce(resolveSelected(list, readSelected())?.id);
        const better = list
          .filter((h) => h.state === "owned")
          .reduce(
            (n, h) =>
              n +
              bestLoadout(
                h.id,
                h.rank,
                resolveSlots(section, h.def),
                pieces,
                h.model?.Equipment,
                items,
              ).length,
            0,
          );
        features.setBadge(
          "character",
          heroesBadge(
            list,
            (lines) => canAfford(lines, balances),
            (e) => resolveLadder(section, e.def),
            better,
          ),
        );
      };
      // Heroes and gear come with the login state; the central cache asks the server only for what
      // is not there yet (a hero given by default).
      update();
      void client.cache.ensureState(["Character"]).then(update);
      return client.on("user:anyUpdated", update);
    }, [client]);
    return createElement("span", { hidden: true });
  };
}
