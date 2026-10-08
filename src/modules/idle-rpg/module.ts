import { defineModule, type Module } from "@idosgames/module-sdk";
import { IdleRpgController } from "./game/IdleRpgController";
import { IdleSession } from "./game/session";
import { createControllerBox } from "./controller-box";
import { createIdleRpgScene } from "./scene";
import { makeGamePanel } from "./ui/GamePanel";
import { characterUpgraded } from "./events";

// Real iDos characters and saved formation surround a transient Grind Heroes stage simulation.
export const idleRpgModule: Module = defineModule({
  id: "idle-rpg",
  meta: { name: "Grind Heroes", type: "game", genre: "idle-rpg", engine: "phaser" },
  setup(ctx) {
    const session = new IdleSession(ctx.client, {
      onRankUp: (characterId, level) => ctx.events.emit(characterUpgraded, { characterId, level }),
    });
    const box = createControllerBox<IdleRpgController>();

    ctx.registerScene(createIdleRpgScene(box, session));
    ctx.registerPanel({
      id: "game", slot: "overlay",
      component: makeGamePanel(session, ctx.features),
    });
    ctx.registerRoute({ id: "idle-rpg", label: "Grind Heroes", icon: "⚔️", inLobby: true });

    // The browser agent cannot read the Phaser canvas. Expose the transient run
    // and the same stage/Advance controls the player sees.
    ctx.exposeToAgent({
      state: () => ({
        mounted: box.get() !== null,
        playing: box.get()?.running ?? false,
        run: session.run.snapshot(),
        advanceEnabled: session.autoProgressEnabled,
        partyCapacity: session.capacity,
        formation: session.formation,
        formationStored: session.formationStored,
        devPreview: session.isDevPreview,
        goldPerSecond: session.ratePerSecond(),
      }),
      actions: {
        selectStage: (args) => session.selectStage(String(args?.stageID ?? "")),
        setAdvance: (args) => session.setAutoProgressEnabled(args?.enabled === true),
      },
      describeActions: {
        selectStage: "Farm an unlocked stage and turn Advance off.",
        setAdvance: "Enable or disable progression after the current battle; combat keeps running.",
      },
    });
  },
});
