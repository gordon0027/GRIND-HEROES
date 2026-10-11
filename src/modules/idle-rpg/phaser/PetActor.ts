import Phaser from "phaser";
import type { StageRun } from "../game/stageRun";
import { PIXELS_PER_WORLD_METRE, projectWorldX, type WorldPresentation } from "../game/worldPresentation";
import { PET_VISUALS, petAnimationKey, type PetMotion } from "./petVisuals";

/** A presentation-only companion. It never enters StageRun or camera tracking. */
export class PetActor {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private petID: string | null = null;
  private worldX = 0;
  private defeated = false;

  constructor(private readonly scene: Phaser.Scene) {}

  destroy(): void {
    this.sprite?.destroy();
    this.sprite = null;
    this.petID = null;
    this.defeated = false;
  }

  update(petID: string | null, run: StageRun, world: WorldPresentation,
    width: number, groundY: number, battleH: number, deltaSeconds: number): void {
    const visual = petID ? PET_VISUALS[petID] : null;
    const front = run.heroes.find((hero) => hero.alive) ?? run.heroes[0];
    if (!visual || !front || !this.scene.textures.exists(visual.textureKey)) {
      this.destroy();
      return;
    }
    const frontX = world.heroWorldX(front.id);
    const fighting = run.state === "encounter" || run.state === "boss";
    const target = fighting ? run.enemies.filter((enemy) => enemy.hp > 0 && enemy.state !== "dead")
      .sort((a, b) => Math.abs(world.enemyWorldX(a.id) - frontX) -
        Math.abs(world.enemyWorldX(b.id) - frontX))[0] : undefined;
    const targetX = target ? world.enemyWorldX(target.id) : null;
    const followX = frontX - visual.formationOffsetMetres;
    const desiredX = targetX === null ? followX :
      Math.max(followX, Math.min(frontX + 12, targetX - visual.attackDistanceMetres));

    if (this.petID !== petID || !this.sprite) {
      this.destroy();
      this.petID = petID;
      this.worldX = followX;
      this.sprite = this.scene.add.sprite(0, 0, visual.textureKey, visual.frames.idle.start)
        .setOrigin(visual.originX, visual.originY).setDepth(3.8);
    }
    const step = Math.max(0, Math.min(deltaSeconds, 0.25));
    const gap = desiredX - this.worldX;
    const maxStep = Math.max(150 * step, Math.abs(gap) * (1 - Math.exp(-step * 6)));
    this.worldX += Math.sign(gap) * Math.min(Math.abs(gap), maxStep);
    const scale = visual.scale * Math.min(1, Math.max(0.7, battleH / 320));
    this.sprite.setScale(scale).setPosition(
      projectWorldX(this.worldX, world.cameraWorldX, width), groundY + visual.offsetY);
    this.sprite.setFlipX(targetX === null || targetX >= this.worldX);

    if (run.state === "failed") this.defeated = true;
    let motion: PetMotion = "idle";
    if (this.defeated) motion = "death";
    else if (targetX !== null) motion =
      targetX - this.worldX <= visual.attackDistanceMetres + 6 ? "attack" : "run";
    else if (run.state === "running" || Math.abs(gap) * PIXELS_PER_WORLD_METRE > 3) motion = "run";
    const key = petAnimationKey(petID!, motion);
    if (this.scene.anims.exists(key) && this.sprite.anims.currentAnim?.key !== key)
      this.sprite.play(key);
  }
}
