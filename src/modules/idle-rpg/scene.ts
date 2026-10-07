import type { EngineScene, SceneMountContext } from "@idosgames/module-sdk";
import { IdleRpgController } from "./game/IdleRpgController";
import type { ControllerBox } from "./controller-box";
import type { IdleSession } from "./game/session";

// Wraps the Phaser controller as a host-driven EngineScene. Created lazily on mount (Phaser needs a
// parent element), published into the shared box for the React panel, and paused/resumed by the
// Mode Router via activate/suspend so a hidden mode stops ticking — and stops collecting gold, which
// the next activation picks up as "while you were away".
export function createIdleRpgScene(
  box: ControllerBox<IdleRpgController>,
  session: IdleSession,
): EngineScene {
  let controller: IdleRpgController | null = null;
  return {
    surface: "fullbleed-canvas",
    mount(ctx: SceneMountContext): void {
      controller = new IdleRpgController(ctx.host, session);
      box.set(controller);
    },
    activate(): void {
      controller?.setRunning(true);
      session.activate();
    },
    suspend(): void {
      controller?.setRunning(false);
      session.suspend();
    },
    capture(): Promise<Blob | null> {
      return controller?.capture() ?? Promise.resolve(null);
    },
    // The host destroys scenes only when it unmounts (a logout): the session goes with them — the next
    // login runs setup() again and builds a new one.
    destroy(): void {
      session.destroy();
      box.set(null);
      controller?.destroy();
      controller = null;
    },
  };
}
