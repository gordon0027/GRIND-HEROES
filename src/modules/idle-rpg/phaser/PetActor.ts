import Phaser from "phaser";
import { ContactShadow } from "./ContactShadow";
import type { StageRun } from "../game/stageRun";
import { PIXELS_PER_WORLD_METRE, projectWorldX, type WorldPresentation } from "../game/worldPresentation";
import { PET_VISUALS, petAnimationKey, type PetMotion } from "./petVisuals";
import { petAttackLunge } from "../game/hitFeedback";

/** A presentation-only companion. It never enters StageRun or camera tracking. */
export class PetActor {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private shadow: ContactShadow | null = null;
  private petID: string | null = null;
  private worldX = 0;
  private defeated = false;

  constructor(private readonly scene: Phaser.Scene) {}

  destroy(): void {
    if (this.sprite) this.scene.tweens.killTweensOf(this.sprite);
    this.shadow?.destroy();
    this.shadow = null;
    this.sprite?.destroy();
    this.sprite = null;
    this.petID = null;
    this.defeated = false;
  }

  update(petID: string | null, run: StageRun, world: WorldPresentation,
    width: number, groundY: number, battleH: number, deltaSeconds: number, reducedMotion = false): void {
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
      Math.max(followX, Math.min(frontX + 28, targetX - visual.attackDistanceMetres));

    if (this.petID !== petID || !this.sprite) {
      const previousX = this.sprite ? this.worldX : followX;
      this.destroy();
      this.petID = petID;
      this.worldX = previousX;
      this.sprite = this.scene.add.sprite(0, 0, visual.textureKey, visual.frames.idle.start)
        .setOrigin(visual.originX, visual.originY);
      const sprite = this.sprite;
      sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => {
        const foot = visual.feetByFrame[Number(sprite.frame.name)];
        if (foot !== undefined) sprite.setOrigin(visual.originX, foot / visual.frameHeight);
      });
      this.shadow = new ContactShadow(this.scene);
    }
    const step = Math.max(0, Math.min(deltaSeconds, 0.25));
    const gap = desiredX - this.worldX;
    const maxStep = Math.max(150 * step, Math.abs(gap) * (1 - Math.exp(-step * 6)));
    if (!this.defeated && run.state !== "failed")
      this.worldX += Math.sign(gap) * Math.min(Math.abs(gap), maxStep);
    const scale = visual.scale * Math.min(1, Math.max(0.7, battleH / 320));
    const lunging = !reducedMotion && targetX !== null && !this.defeated &&
      this.sprite.anims.currentAnim?.key === petAnimationKey(petID!, "attack");
    const lunge = lunging ? petAttackLunge(Number(this.sprite.frame.name)) * scale *
      (targetX! >= this.worldX ? 1 : -1) : 0;
    this.sprite.setScale(scale).setPosition(
      projectWorldX(this.worldX, world.cameraWorldX, width) + lunge, groundY + visual.offsetY).setDepth(4 + (groundY + visual.offsetY) / 1000);
    this.shadow?.follow(this.sprite.x, groundY + visual.offsetY, visual.frameWidth * scale * 0.64);
    if (!this.defeated) this.sprite.setFlipX(targetX === null || targetX >= this.worldX);

    if (run.state === "failed" && !this.defeated) {
      this.defeated = true;
      this.shadow?.fade();
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 240 });
      });
    }
    let motion: PetMotion = "idle";
    if (this.defeated) motion = "death";
    else if (targetX !== null) motion =
      Math.abs(targetX - this.worldX) <= visual.attackDistanceMetres + 6 ? "attack" : "run";
    else if (run.state === "running" || Math.abs(gap) * PIXELS_PER_WORLD_METRE > 3) motion = "run";
    const key = petAnimationKey(petID!, motion);
    if (this.scene.anims.exists(key) && this.sprite.anims.currentAnim?.key !== key)
      this.sprite.play(key);
  }
}
