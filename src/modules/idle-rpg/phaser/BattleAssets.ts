import Phaser from "phaser";
import { ENEMY_VISUALS, enemyAnimationKey, registerEnemyAnimations, type EnemyVisualID } from "./enemyVisuals";

export const BACKGROUNDS = {
  forest: { key: "grind-stage-meadow-road", file: "meadow-road.png" },
  act2: { key: "grind-stage-orange-bastion", file: "act2.png" },
  act3: { key: "grind-stage-undead-crypt", file: "act3.png" },
} as const;

const chapterFor = (id: string) => id.startsWith("orange") ? 2 :
  id.startsWith("undead") || id === "zombieOgre" ? 3 : 1;

/** Keep just the active Act's large sheets/background resident on mobile. */
export class BattleAssets {
  private loading = false;
  constructor(private readonly scene: Phaser.Scene) {}

  queue(chapter: number): void {
    for (const [id, v] of Object.entries(ENEMY_VISUALS)) {
      if (chapterFor(id) !== chapter || this.scene.textures.exists(v.textureKey)) continue;
      this.scene.load.spritesheet(v.textureKey, v.assetPath,
        { frameWidth: v.frameWidth, frameHeight: v.frameHeight });
    }
    const bg = chapter === 1 ? BACKGROUNDS.forest : chapter === 2 ? BACKGROUNDS.act2 : BACKGROUNDS.act3;
    if (!this.scene.textures.exists(bg.key))
      this.scene.load.image(bg.key, `${import.meta.env.BASE_URL}assets/backgrounds/stages/${bg.file}`);
  }

  ensure(chapter: number): void {
    const key = chapter === 1 ? BACKGROUNDS.forest.key : chapter === 2 ? BACKGROUNDS.act2.key : BACKGROUNDS.act3.key;
    if (this.loading || this.scene.textures.exists(key)) return;
    this.loading = true;
    this.queue(chapter);
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.loading = false;
      registerEnemyAnimations(this.scene);
    });
    this.scene.load.start();
  }

  releaseOthers(chapter: number): void {
    const bg = chapter === 1 ? BACKGROUNDS.forest : chapter === 2 ? BACKGROUNDS.act2 : BACKGROUNDS.act3;
    if (this.loading || !this.scene.textures.exists(bg.key)) return;
    for (const [id, v] of Object.entries(ENEMY_VISUALS)) {
      if (chapterFor(id) === chapter || !this.scene.textures.exists(v.textureKey)) continue;
      for (const motion of ["idle", "run", "attack", "death"] as const)
        this.scene.anims.remove(enemyAnimationKey(id as EnemyVisualID, motion));
      this.scene.textures.remove(v.textureKey);
    }
    for (const other of Object.values(BACKGROUNDS))
      if (other.key !== bg.key && this.scene.textures.exists(other.key)) this.scene.textures.remove(other.key);
  }
}
