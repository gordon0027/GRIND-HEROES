import Phaser from "phaser";
import { GrindScene } from "../phaser/GrindScene";
import type { IdleSession } from "./session";

/**
 * Owns the Phaser game that draws the session's fight. Created on mount (Phaser needs the host
 * element), destroyed with the mode — the session (and with it the fight and the progress) lives on.
 */
export class IdleRpgController {
  private readonly game: Phaser.Game;

  constructor(
    parent: HTMLElement,
    readonly session: IdleSession,
  ) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: parent.clientWidth || 480,
      height: parent.clientHeight || 800,
      backgroundColor: "#7ec8ff",
      pixelArt: true,
      roundPixels: true,
      scene: new GrindScene(session),
      scale: {
        // The canvas fills the full-bleed host; the scene draws the field into its top part and the
        // module's panel covers the rest (layout.ts).
        mode: Phaser.Scale.RESIZE,
      },
    });

    // Makes the game observable in the AI Coder's live preview, which reads this exact global.
    //
    // Phaser sets it itself — but only in its debug build (`Game.boot` guards it behind
    // WEBGL_DEBUG), and the release build shipped by npm has that branch stripped. So a Phaser game
    // is invisible to any outside observer unless it hands itself over, which is this one line.
    // Verified live: without it the preview reports no engine; with it, scenes, object counts,
    // camera and loop fps all come through.
    (globalThis as unknown as Record<string, unknown>).PHASER_GAME = this.game;
  }

  /** Whether the Phaser loop is running (the agent's "am I even running" flag). */
  get running(): boolean {
    return this.game.loop.running;
  }

  /** Pause/resume the Phaser RAF loop. The host calls this so a suspended mode stops ticking
   *  (the Mode Router invariant: only the active mode runs) — and the fight with it. */
  setRunning(running: boolean): void {
    if (running) this.game.loop.wake();
    else this.game.loop.sleep();
  }

  /**
   * Один кадр игры для платформенной кнопки «поделиться снимком».
   *
   * ⚠ Через `renderer.snapshot`, а НЕ `canvas.toBlob`. У WebGL-рендерера Phaser (как и у любого
   * другого) буфер отрисовки очищен к моменту, когда до канвы доберётся посторонний код, и чтение
   * снаружи отдаёт ЧЁРНЫЙ прямоугольник, ничем не пожаловавшись — проверено живьём на стенде,
   * ровно так этот модуль и снимался, пока снимал его общий запасной путь хоста. `snapshot`
   * встроен в Phaser именно для этого: он забирает пиксели сразу после следующей отрисовки.
   *
   * Поэтому же сначала `wake()`: у остановленного цикла (режим только что был скрыт) следующей
   * отрисовки не случится вовсе, и обещание висело бы до таймаута.
   */
  capture(): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
      let settled = false;
      const finish = (value: Blob | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      // Кадр не пришёл (контекст потерян, игра уничтожена между вызовом и отрисовкой) — отвечаем
      // «нет», а не висим: у вызывающего за нами стоит следующий способ снять игру.
      setTimeout(() => finish(null), 1500);

      try {
        this.game.loop.wake();
        this.game.renderer.snapshot((result) => {
          if (!(result instanceof HTMLImageElement)) return finish(null);
          const canvas = document.createElement("canvas");
          canvas.width = result.naturalWidth || result.width;
          canvas.height = result.naturalHeight || result.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return finish(null);
          ctx.drawImage(result, 0, 0);
          canvas.toBlob(finish, "image/png");
        });
      } catch {
        finish(null);
      }
    });
  }

  destroy(): void {
    this.game.destroy(true);
    // Drop the debug global with the game itself: the Mode Router destroys a suspended mode, and a
    // stale reference here would show an observer a game that no longer exists.
    const globals = globalThis as unknown as Record<string, unknown>;
    if (globals["PHASER_GAME"] === this.game) delete globals["PHASER_GAME"];
  }
}
