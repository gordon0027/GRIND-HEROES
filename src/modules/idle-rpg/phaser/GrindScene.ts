import Phaser from "phaser";
import type { IdleSession } from "../game/session";
import type { BattleRenderSize } from "../game/renderResolution";
import type { EnemyProjectile, PendingProjectile, RuntimeEnemy, RuntimeHero, RunEvent, StageRun } from "../game/stageRun";
import { battleHeight } from "../layout";
import { heroArchetype } from "../game/heroArchetypes";
import { attackDuration, attackPlaybackScale, enemyAttackTiming,
  heroAttackTiming } from "../game/combatTiming";
import { WorldPresentation, projectWorldX, PIXELS_PER_WORLD_METRE,
  type PresentedEnemy } from "../game/worldPresentation";
import { HERO_VISUALS, heroAnimationKey, registerHeroAnimations } from "./heroVisuals";
import { ENEMY_VISUALS, enemyAnimationKey, registerEnemyAnimations,
  type EnemyVisualID } from "./enemyVisuals";
import { drawHealthBar, drawSkillCooldownBar } from "./healthBars";
import { PET_VISUALS, registerPetAnimations } from "./petVisuals";
import { PetActor } from "./PetActor";
import { ContactShadow } from "./ContactShadow";
import { enemyGroundSlot } from "../game/encounterLayout";
import { BattleAssets, BACKGROUNDS } from "./BattleAssets";
import { effectiveAttackSpeed, COMBAT_SKILLS, skillFor } from "../game/combatSkills";
import { drawRapidFireAura, meteorGroundFire, skillBurst } from "./SkillEffects";
import { hitProfile } from "../game/hitFeedback";
import { CombatJuice } from "./CombatJuice";

const BACKGROUND_ASPECT = 3840 / 2160;
const FOREST_TILE_WORLD_METRES = 600;
const ARROW_KEY = "grind-short-willow-arrow";
const ARROW_PATH = `${import.meta.env.BASE_URL}assets/projectiles/ShortWillowBow.png`;
const ARROW_FRAME = 3; // 3 columns x 2 rows: bottom-left is (0, 128, 128, 128).
const ORB_KEY = "grind-mage-red-orb";
const METEOR_KEY = "grind-meteor-fireball";
const PROJECTILE_SIZE = { ARROW: 32, MAGIC_ORB: 18, METEOR_FIREBALL: 56 } as const;
const PROJECTILE_TARGET_Y = { normal: -55, boss: -85 } as const;

interface HeroActor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: ContactShadow;
  attackUntil: number;
  deathPlayed: boolean;
}

interface EnemyActor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: ContactShadow;
}

interface EnemyCorpse {
  sprite: Phaser.GameObjects.Sprite;
  shadow: ContactShadow;
  readonly deathWorldX: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly flashUntil: number;
}

interface ProjectileActor {
  sprite: Phaser.GameObjects.Sprite;
  trail?: Phaser.GameObjects.Graphics;
  targetId?: number;
  type?: PendingProjectile["type"];
  fromWorldX: number;
  toWorldX: number;
  fromOffsetY?: number;
}

/** Phaser paints the run; StageRun still owns distance, positions, damage and outcomes. */
export class GrindScene extends Phaser.Scene {
  private enemyBars?: Phaser.GameObjects.Graphics;
  private enemyPaint?: Phaser.GameObjects.Graphics;
  private heroBars?: Phaser.GameObjects.Graphics;
  private auraPaint?: Phaser.GameObjects.Graphics;
  private backgroundTiles: Phaser.GameObjects.Image[] = [];
  private actors = new Map<string, HeroActor>();
  private enemyActors = new Map<number, EnemyActor>();
  private corpses = new Map<number, EnemyCorpse>();
  private projectileActors = new Map<number, ProjectileActor>();
  private enemyProjectileActors = new Map<number, ProjectileActor>();
  private juice = new CombatJuice(this);
  private skillCasts = { Knight: 0, Archer: 0, Mage: 0 };
  private petActor = new PetActor(this);
  private battleAssets = new BattleAssets(this);
  private world = new WorldPresentation();
  private visualTime = 0;
  private lastRun: StageRun | null = null;
  private lastElapsed = 0;
  private reducedMotion = false;
  private lastDiagnosticsAt = 0;

  constructor(private readonly session: IdleSession,
    private readonly getRenderSize: () => BattleRenderSize) { super("grind-stage"); }

  private syncCameraResolution(): void {
    const { scaleX, scaleY } = this.getRenderSize();
    this.cameras.main.setOrigin(0, 0).setZoom(scaleX, scaleY);
  }

  preload(): void {
    for (const visual of Object.values(HERO_VISUALS))
      this.load.spritesheet(visual.textureKey, visual.assetPath,
        { frameWidth: visual.frameWidth, frameHeight: visual.frameHeight });
    for (const visual of Object.values(PET_VISUALS))
      this.load.spritesheet(visual.textureKey, visual.assetPath,
        { frameWidth: visual.frameWidth, frameHeight: visual.frameHeight });
    this.battleAssets.queue(this.session.run.stage.chapter);
    this.load.spritesheet(ARROW_KEY, ARROW_PATH, { frameWidth: 128, frameHeight: 128 });
  }

  create(): void {
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.juice.reducedMotion = this.reducedMotion;
    this.syncCameraResolution();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.syncCameraResolution, this);
    registerHeroAnimations(this);
    registerEnemyAnimations(this);
    registerPetAnimations(this);
    const orb = this.add.graphics();
    orb.fillStyle(0xff3737, 0.18).fillCircle(12, 12, 12);
    orb.fillStyle(0xe22229, 0.85).fillCircle(12, 12, 7);
    orb.fillStyle(0xffb5a3).fillCircle(10, 10, 3);
    orb.generateTexture(ORB_KEY, 24, 24);
    orb.destroy();
    const meteor = this.add.graphics();
    meteor.fillStyle(0xff5a20, 0.16).fillCircle(24, 24, 23);
    meteor.fillStyle(0xff7029, 0.38).fillCircle(24, 24, 19);
    meteor.fillStyle(0xffa23b, 0.85).fillCircle(24, 24, 14);
    meteor.fillStyle(0xfff3b0, 1).fillCircle(22, 21, 8);
    meteor.fillStyle(0xffffff, 0.8).fillCircle(20, 19, 3);
    meteor.generateTexture(METEOR_KEY, 48, 48);
    meteor.destroy();
    this.enemyPaint = this.add.graphics().setDepth(3);
    this.heroBars = this.add.graphics().setDepth(7);
    this.auraPaint = this.add.graphics().setDepth(5.8).setBlendMode(Phaser.BlendModes.ADD);
    this.enemyBars = this.add.graphics().setDepth(7);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.syncCameraResolution, this);
      this.resetActors();
    });
  }

  override update(_time: number, deltaMs: number): void {
    const run = this.session.run;
    this.battleAssets.ensure(run.stage.chapter);
    if (run !== this.lastRun || run.elapsedSeconds < this.lastElapsed - 0.1) {
      this.resetActors();
      this.world.reset();
    }
    this.lastRun = run;
    const beforeEnemies = new Map(run.enemies.map((e) => [e.id,
      { hp: e.hp, worldX: this.world.enemyWorldX(e.id), boss: e.boss,
        visual: e.visual ?? "goblin1", formationIndex: e.formationIndex }] as const));
    const beforeHeroes = new Map(run.heroes.map((h) => [h.id, h.hp] as const));
    const events = this.session.tickRun(deltaMs / 1000);
    for (const event of events) {
      if (event.type !== "skillActivated") continue;
      if (event.skillId === COMBAT_SKILLS.Knight.id) this.skillCasts.Knight++;
      else if (event.skillId === COMBAT_SKILLS.Archer.id) this.skillCasts.Archer++;
      else if (event.skillId === COMBAT_SKILLS.Mage.id) this.skillCasts.Mage++;
    }
    const { cssWidth: w, cssHeight } = this.getRenderSize();
    this.world.update(run, deltaMs / 1000 * (this.session.isDevPreview ? this.session.previewRate : 1), w);
    this.visualTime += Math.max(0, deltaMs);
    this.juice.beginFrame(this.visualTime);
    this.lastElapsed = run.elapsedSeconds;
    const h = battleHeight(cssHeight);
    const groundY = h * 0.82;
    this.drawBackground(run, w, h, groundY);
    this.battleAssets.releaseOthers(run.stage.chapter);
    this.showCombatFeedback(run.enemies, beforeEnemies, beforeHeroes, events, w, groundY);
    this.drawEnemies(this.world.visibleEnemies(run), events, beforeEnemies, w, groundY, h);
    this.syncHeroes(run.heroes, events, w, groundY, h);
    this.petActor.update(this.session.visiblePetId, run, this.world, w, groundY, h,
      deltaMs / 1000 * (this.session.isDevPreview ? this.session.previewRate : 1), this.reducedMotion);
    this.syncProjectiles(run.projectiles, run.enemies, w, groundY, h);
    this.syncEnemyProjectiles(run.enemyProjectiles, w, groundY, h);
    this.juice.project(this.world.cameraWorldX, w, groundY, Math.min(1, Math.max(0.7, h / 320)));
    this.juice.endFrame();
    if (this.visualTime - this.lastDiagnosticsAt >= 1000) {
      this.lastDiagnosticsAt = this.visualTime;
      const textures = Object.values(this.textures.list);
      this.session.renderDiagnostics = { fps: Math.round(this.game.loop.actualFps),
        objects: this.children.list.length, actors: this.actors.size + this.enemyActors.size,
        corpses: this.corpses.size, vfx: this.juice.objects.size,
        feedback: JSON.stringify(this.juice.stats),
        casts: `K:${this.skillCasts.Knight} A:${this.skillCasts.Archer} M:${this.skillCasts.Mage}`,
        cooldowns: run.heroes.map((hero) => `${hero.classId[0]}:${hero.skillCooldown.toFixed(1)}`).join(" "),
        projectiles: this.projectileActors.size + this.enemyProjectileActors.size,
        textures: textures.length,
        textureMiB: Math.round(textures.reduce((sum, t) => sum + t.source.reduce((n: number, s: { width: number; height: number }) =>
          n + s.width * s.height * 4, 0), 0) / 1048576), width: w,
      };
    }
  }

  private resetActors(): void {
    this.juice.reset();
    this.petActor.destroy();
    for (const actor of this.actors.values()) {
      this.tweens.killTweensOf(actor.sprite); actor.shadow.destroy(); actor.sprite.destroy();
    }
    this.actors.clear();
    for (const actor of this.enemyActors.values()) {
      this.tweens.killTweensOf(actor.sprite); actor.shadow.destroy(); actor.sprite.destroy();
    }
    this.enemyActors.clear();
    for (const corpse of this.corpses.values()) {
      this.tweens.killTweensOf(corpse.sprite);
      corpse.shadow.destroy();
      corpse.sprite.destroy();
    }
    this.corpses.clear();
    for (const actor of this.projectileActors.values()) {
      actor.trail?.destroy(); actor.sprite.destroy();
    }
    this.projectileActors.clear();
    for (const actor of this.enemyProjectileActors.values()) actor.sprite.destroy();
    this.enemyProjectileActors.clear();
    this.skillCasts = { Knight: 0, Archer: 0, Mage: 0 };
  }

  private syncProjectiles(projectiles: readonly PendingProjectile[], enemies: readonly RuntimeEnemy[],
    width: number, groundY: number, battleH: number): void {
    const active = new Set(projectiles.map((shot) => shot.id));
    for (const [id, actor] of this.projectileActors) {
      if (active.has(id)) continue;
      actor.trail?.destroy();
      actor.sprite.destroy();
      this.projectileActors.delete(id);
    }
    const battleScale = Math.min(1, Math.max(0.7, battleH / 320));
    for (const shot of projectiles) {
      let actor = this.projectileActors.get(shot.id);
      const visual = HERO_VISUALS[shot.attackerId];
      const origin = visual?.projectileOrigin;
      const enemy = enemies.find((entry) => entry.id === shot.targetId);
      if (!actor) {
        const fromWorldX = this.world.heroWorldX(shot.attackerId) +
          (origin?.x ?? 0) * (visual?.scale ?? 1) * battleScale / PIXELS_PER_WORLD_METRE;
        const enemyVisual = enemy?.visual && enemy.visual in ENEMY_VISUALS
          ? ENEMY_VISUALS[enemy.visual as EnemyVisualID] : ENEMY_VISUALS.goblin1;
        const toWorldX = (enemy ? this.world.enemyWorldX(shot.targetId) :
          this.world.heroWorldX(shot.attackerId) + (shot.targetX - shot.originX) * 250) +
          (enemyVisual.contactOffsetPx + enemyGroundSlot(enemy?.formationIndex ?? 0).x) *
          battleScale / PIXELS_PER_WORLD_METRE;
        const texture = shot.type === "ARROW" ? ARROW_KEY :
          shot.type === "METEOR_FIREBALL" ? METEOR_KEY : ORB_KEY;
        if (!this.textures.exists(texture)) continue;
        const sprite = this.add.sprite(0, 0, texture, shot.type === "ARROW" ? ARROW_FRAME : undefined)
          .setDisplaySize(PROJECTILE_SIZE[shot.type] * battleScale,
            PROJECTILE_SIZE[shot.type] * battleScale).setDepth(6);
        if (shot.type === "METEOR_FIREBALL") sprite.setBlendMode(Phaser.BlendModes.ADD);
        if (shot.empowered)
          sprite.setTint(0x99ff80);
        actor = { sprite, fromWorldX, toWorldX, targetId: shot.targetId, type: shot.type,
          trail: shot.type === "METEOR_FIREBALL" || shot.empowered
            ? this.add.graphics().setDepth(5.9).setBlendMode(Phaser.BlendModes.ADD) : undefined };
        this.projectileActors.set(shot.id, actor);
      }
      actor.sprite.setVisible(shot.elapsed >= 0);
      actor.trail?.setVisible(shot.elapsed >= 0);
      if (shot.elapsed < 0) continue; // Preserve the target anchor during the cast wind-up.
      const progress = Math.min(1, Math.max(0, shot.elapsed / shot.travelDuration));
      const fromX = projectWorldX(actor.fromWorldX, this.world.cameraWorldX, width);
      const toX = projectWorldX(actor.toWorldX, this.world.cameraWorldX, width);
      const fromY = groundY + (visual?.offsetY ?? 0) +
        (origin?.y ?? -40) * (visual?.scale ?? 1) * battleScale;
      const toY = groundY + ((enemy?.boss ? PROJECTILE_TARGET_Y.boss : PROJECTILE_TARGET_Y.normal) +
        enemyGroundSlot(enemy?.formationIndex ?? 0).y) * battleScale;
      const x = fromX + (toX - fromX) * progress;
      const y = fromY + (toY - fromY) * progress;
      actor.sprite.setDisplaySize(PROJECTILE_SIZE[shot.type] * battleScale,
        PROJECTILE_SIZE[shot.type] * battleScale).setPosition(x, y);
      if (actor.trail) {
        actor.trail.clear();
        const length = shot.type === "METEOR_FIREBALL" ? 43 : 27;
        const endX = x - Math.sign(toX - fromX || 1) * length * battleScale;
        actor.trail.lineStyle(shot.type === "METEOR_FIREBALL" ? 12 : 5,
          shot.type === "METEOR_FIREBALL" ? 0xff7827 : 0x84ef6c, 0.62)
          .lineBetween(endX, y + 3, x, y);
        if (shot.type === "METEOR_FIREBALL") {
          actor.trail.lineStyle(4, 0xffd473, 0.88).lineBetween(endX - 8, y + 5, x - 4, y);
          for (let i = 0; i < 3; i++) {
            const drift = (this.visualTime / 30 + i * 15) % 40;
            actor.trail.fillStyle(i === 0 ? 0xfff1a3 : 0xffa947, 0.8 - i * 0.12)
              .fillCircle(x - Math.sign(toX - fromX || 1) * (12 + drift) * battleScale,
                y + Math.sin(this.visualTime / 80 + i * 2) * (5 + i * 3) * battleScale,
                (2.5 - i * 0.4) * battleScale);
          }
        } else {
          actor.trail.lineStyle(2, 0xd5ffc0, 0.88).lineBetween(endX, y + 3, x, y);
        }
      }
      if (shot.type === "ARROW")
        actor.sprite.setRotation(Math.atan2(toY - fromY, toX - fromX) + Math.PI / 2);
    }
  }

  private syncEnemyProjectiles(projectiles: readonly EnemyProjectile[], width: number,
    groundY: number, battleH: number): void {
    const active = new Set(projectiles.map((shot) => shot.id));
    for (const [id, actor] of this.enemyProjectileActors) {
      if (active.has(id)) continue;
      actor.sprite.destroy();
      this.enemyProjectileActors.delete(id);
    }
    const scale = Math.min(1, Math.max(0.7, battleH / 320));
    for (const shot of projectiles) {
      let actor = this.enemyProjectileActors.get(shot.id);
      if (!actor) {
        const shooter = this.session.run.enemies.find(enemy => enemy.id === shot.attackerId);
        const slot = enemyGroundSlot(shooter?.formationIndex ?? 0);
        const sprite = this.add.sprite(0, 0, ARROW_KEY, ARROW_FRAME)
          .setDisplaySize(25 * scale, 25 * scale).setDepth(6)
          .setTint(this.session.run.stage.chapter === 3 ? 0xb4d8d8 : 0xffba7b);
        actor = { sprite,
          fromWorldX: this.world.enemyWorldX(shot.attackerId) + (slot.x - 12) * scale / PIXELS_PER_WORLD_METRE,
          toWorldX: this.world.heroWorldX(shot.targetId),
          fromOffsetY: slot.y,
        };
        this.enemyProjectileActors.set(shot.id, actor);
      }
      actor.sprite.setVisible(shot.elapsed >= 0);
      if (shot.elapsed < 0) continue;
      const progress = Math.min(1, Math.max(0, shot.elapsed / shot.travelDuration));
      const fromX = projectWorldX(actor.fromWorldX, this.world.cameraWorldX, width);
      const toX = projectWorldX(actor.toWorldX, this.world.cameraWorldX, width);
      const fromY = groundY + ((actor.fromOffsetY ?? 0) - 60) * scale;
      const toY = groundY - 62 * scale;
      actor.sprite.setPosition(fromX + (toX - fromX) * progress,
        fromY + (toY - fromY) * progress)
        .setRotation(Math.atan2(toY - fromY, toX - fromX) + Math.PI / 2);
    }
  }

  private drawBackground(run: StageRun, w: number, h: number, groundY: number): void {
    const g = this.enemyPaint!;
    g.clear();
    const background = BACKGROUNDS[run.stage.environment as keyof typeof BACKGROUNDS] ?? BACKGROUNDS.forest;
    if (h >= 100 && this.textures.exists(background.key)) {
      // Mirrored neighbors have identical touching edges; the source PNG is not seamless.
      const tileWidth = h * BACKGROUND_ASPECT;
      const count = Math.ceil(w / tileWidth) + 2;
      while (this.backgroundTiles.length < count)
        this.backgroundTiles.push(this.add.image(0, 0, background.key).setOrigin(0).setDepth(0));
      // Keep the same part of the forest visible when the tile is rescaled on resize.
      const tilesTraveled = Math.max(0, this.world.cameraWorldX / FOREST_TILE_WORLD_METRES);
      const base = Math.floor(tilesTraveled);
      const phase = (tilesTraveled - base) * tileWidth;
      this.backgroundTiles.forEach((tile, i) => {
        tile.setVisible(i < count);
        if (i >= count) return;
        if (tile.texture.key !== background.key) tile.setTexture(background.key);
        tile.setDisplaySize(tileWidth, h).setPosition(i * tileWidth - phase, 0);
        tile.setFlipX((base + i) % 2 !== 0);
      });
      return;
    }
    for (const tile of this.backgroundTiles) tile.setVisible(false);
    g.fillStyle(0x8dc9ed).fillRect(0, 0, w, h);
    g.fillStyle(0x80ba79).fillRect(0, groundY - 36, w, 36);
    g.fillStyle(0x618f54).fillRect(0, groundY, w, h - groundY);
    g.lineStyle(3, 0x466d3b).lineBetween(0, groundY, w, groundY);
    const scroll = (this.world.cameraWorldX * PIXELS_PER_WORLD_METRE % 80 + 80) % 80 / 80;
    g.fillStyle(0xb2d396);
    for (let i = -1; i < Math.ceil(w / 80) + 2; i++) {
      const x = i * 80 - scroll * 80;
      g.fillRect(x, groundY + 20, 28, 5);
    }
  }

  private drawEnemies(enemies: readonly PresentedEnemy[], events: readonly RunEvent[],
    before: ReadonlyMap<number, { hp: number; worldX: number; boss: boolean; visual: string; formationIndex: number }>,
    w: number, groundY: number, battleH: number): void {
    const g = this.enemyBars!;
    g.clear();
    for (const corpse of this.corpses.values()) {
      corpse.sprite.setPosition(projectWorldX(corpse.deathWorldX, this.world.cameraWorldX, w) +
        corpse.offsetX, groundY + corpse.offsetY);
      corpse.shadow.follow(corpse.sprite.x, groundY + corpse.offsetY, corpse.sprite.getData("shadowWidth"));
      if (this.visualTime < corpse.flashUntil) corpse.sprite.setTint(0xffeee2).setTintMode(Phaser.TintModes.FILL);
      else corpse.sprite.clearTint();
    }
    const active = new Set(enemies.map((enemy) => enemy.id));
    const defeated = new Set(events.filter((e) => e.type === "enemyDefeated").map((e) => e.id));
    for (const [id, actor] of this.enemyActors) {
      if (active.has(id)) continue;
      this.juice.release(actor.sprite);
      this.enemyActors.delete(id);
      if (defeated.has(id)) {
        const old = before.get(id);
        const visual = actor.sprite.getData("visual") as EnemyVisualID;
        if (!old) { actor.shadow.destroy(); actor.sprite.destroy(); continue; }
        const scale = Math.min(1, Math.max(0.7, battleH / 320));
        const offsetX = ENEMY_VISUALS[visual].contactOffsetPx * scale +
          (actor.sprite.getData("slotX") ?? 0);
        const offsetY = actor.sprite.getData("slotY") ?? 0;
        actor.shadow.fade();
        this.corpses.set(id, { sprite: actor.sprite, shadow: actor.shadow, deathWorldX: old.worldX,
          offsetX, offsetY, flashUntil: this.visualTime + (old.boss ? 120 : 90) });
        actor.sprite.setPosition(projectWorldX(old.worldX, this.world.cameraWorldX, w) +
          offsetX, groundY + offsetY).setTint(0xffeee2).setTintMode(Phaser.TintModes.FILL);
        this.juice.death(old.worldX + offsetX / PIXELS_PER_WORLD_METRE, offsetY / scale, old.boss);
        this.fadeCorpse(actor.sprite, () => { actor.shadow.destroy(); this.corpses.delete(id); });
        actor.sprite.anims.timeScale = 1;
        actor.sprite.play(enemyAnimationKey(visual, "death"));
      } else { actor.shadow.destroy(); actor.sprite.destroy(); }
    }
    // A very fast kill can occur on the same frame that the enemy first enters view.
    for (const id of defeated) {
      if (this.corpses.has(id)) continue;
      const old = before.get(id);
      if (!old) continue;
      const visualID = old.visual in ENEMY_VISUALS ? old.visual as EnemyVisualID : "goblin1";
      const visual = ENEMY_VISUALS[visualID];
      if (!this.textures.exists(visual.textureKey) ||
          !this.anims.exists(enemyAnimationKey(visualID, "death"))) continue;
      const scale = Math.min(1, Math.max(0.7, battleH / 320));
      const offsetX = (visual.contactOffsetPx + enemyGroundSlot(old.formationIndex).x) * scale;
      const offsetY = visual.offsetY + enemyGroundSlot(old.formationIndex).y * scale;
      const sprite = this.add.sprite(
        projectWorldX(old.worldX, this.world.cameraWorldX, w) + offsetX,
        groundY + offsetY, visual.textureKey, visual.frames.death.start,
      ).setOrigin(visual.originX, visual.originY).setScale(visual.scale * scale)
        .setDepth(4 + (groundY + offsetY) / 1000);
      const shadow = new ContactShadow(this);
      shadow.follow(sprite.x, groundY + offsetY, (old.boss ? 100 : 36) * scale);
      sprite.setData("shadowWidth", (old.boss ? 100 : 36) * scale);
      shadow.fade();
      this.corpses.set(id, { sprite, shadow, deathWorldX: old.worldX, offsetX, offsetY,
        flashUntil: this.visualTime + (old.boss ? 120 : 90) });
      sprite.setTint(0xffeee2).setTintMode(Phaser.TintModes.FILL);
      this.juice.death(old.worldX + offsetX / PIXELS_PER_WORLD_METRE, offsetY / scale, old.boss);
      this.fadeCorpse(sprite, () => { shadow.destroy(); this.corpses.delete(id); });
      sprite.play(enemyAnimationKey(visualID, "death"));
    }
    const attacks = new Set(events.filter((e) => e.type === "enemyAttackStarted").map((e) => e.id));
    for (const enemy of enemies) {
      const visualID = enemy.visual in ENEMY_VISUALS ? enemy.visual as EnemyVisualID : "goblin1";
      const visual = ENEMY_VISUALS[visualID];
      if (!visual || !this.textures.exists(visual.textureKey) ||
          !this.anims.exists(enemyAnimationKey(visualID, "run"))) continue;
      const battleScale = Math.min(1, Math.max(0.7, battleH / 320));
      const x = projectWorldX(enemy.worldX, this.world.cameraWorldX, w) +
        visual.contactOffsetPx * battleScale + enemyGroundSlot(enemy.formationIndex).x * battleScale;
      const slotY = enemyGroundSlot(enemy.formationIndex).y * battleScale;
      let actor = this.enemyActors.get(enemy.id);
      if (!actor) {
        const sprite = this.add.sprite(x, groundY, visual.textureKey, visual.frames.run.start)
          .setOrigin(visual.originX, visual.originY).setDepth(4).setData("visual", visualID);
        actor = { sprite, shadow: new ContactShadow(this) };
        this.enemyActors.set(enemy.id, actor);
      }
      const scale = visual.scale * battleScale;
      const recoil = this.juice.apply(actor.sprite, `enemy:${enemy.id}`) * battleScale;
      actor.sprite.setScale(scale).setPosition(x + recoil, groundY + visual.offsetY + slotY).setFlipX(false)
        .setDepth(4 + (groundY + slotY) / 1000)
        .setData("slotX", enemyGroundSlot(enemy.formationIndex).x * battleScale)
        .setData("slotY", slotY).setData("shadowWidth", (enemy.boss ? 100 : 36) * scale);
      actor.shadow.follow(x, groundY + slotY, (enemy.boss ? 100 : 36) * scale);
      if (attacks.has(enemy.id)) {
        const speed = this.lastRun?.enemies.find((entry) => entry.id === enemy.id)?.attackSpeed ?? 1;
        actor.sprite.anims.timeScale = attackPlaybackScale(enemyAttackTiming(enemy.boss).fps, speed);
        actor.sprite.play(enemyAnimationKey(visualID, "attack"));
      } else {
        const attackPlaying = actor.sprite.anims.currentAnim?.key ===
          enemyAnimationKey(visualID, "attack") && actor.sprite.anims.isPlaying;
        if (!attackPlaying) {
          const motion = enemy.state === "attacking" ? "idle" : "run";
          const key = enemyAnimationKey(visualID, motion);
          if (actor.sprite.anims.currentAnim?.key !== key || !actor.sprite.anims.isPlaying) {
            actor.sprite.anims.timeScale = 1;
            actor.sprite.play(key, true);
          }
        }
      }
      const width = enemy.boss ? 110 : 48;
      // The top HUD covers a tall boss's head; put its wider bar below the feet.
      const barY = enemy.boss ? groundY + slotY + 7 : groundY + slotY - 108 * scale;
      drawHealthBar(g, x, barY, width, enemy.hp / enemy.maxHp, enemy.boss ? "boss" : "enemy");
    }
  }

  private syncHeroes(heroes: readonly RuntimeHero[], events: readonly RunEvent[],
    w: number, groundY: number, battleH: number): void {
    const active = new Set(heroes.map((hero) => hero.id));
    for (const [id, actor] of this.actors) {
      if (active.has(id)) continue;
      this.juice.release(actor.sprite);
      actor.shadow.destroy();
      actor.sprite.destroy();
      this.actors.delete(id);
    }
    const attacks = new Set(events.filter((e) => e.type === "heroAttacked").map((e) => e.id));
    const bars = this.heroBars!;
    bars.clear();
    const aura = this.auraPaint!;
    aura.clear();
    for (const hero of heroes) {
      const visual = HERO_VISUALS[hero.id];
      const x = projectWorldX(this.world.heroWorldX(hero.id), this.world.cameraWorldX, w);
      const y = groundY + (visual?.offsetY ?? 0) + (hero.slot === 2 ? -8 : hero.slot === 3 ? 6 : 0);
      const scale = (visual?.scale ?? 1) * Math.min(1, Math.max(0.7, battleH / 320));
      const barY = y - 135 * scale;
      const skill = skillFor(hero.classId);
      if (skill) drawSkillCooldownBar(bars, x, barY, 46,
        hero.alive ? 1 - hero.skillCooldown / skill.cooldown : 0);
      drawHealthBar(bars, x, barY, 46, hero.hp / hero.maxHp, "hero");
      drawRapidFireAura(aura, hero, x, y, scale, this.visualTime);
      if (!visual || !this.textures.exists(visual.textureKey)) {
        this.enemyPaint!.fillStyle(hero.alive ? heroArchetype(hero.id).color : 0x65718a)
          .fillRoundedRect(x - 18, y - 58, 36, 58, 5);
        continue;
      }
      let actor = this.actors.get(hero.id);
      if (!actor) {
        const sprite = this.add.sprite(x, y, visual.textureKey, visual.frames.idle.start)
          .setOrigin(visual.originX, visual.originY).setDepth(5);
        actor = { sprite, shadow: new ContactShadow(this), attackUntil: 0, deathPlayed: false };
        this.actors.set(hero.id, actor);
      }
      const recoil = this.juice.apply(actor.sprite, `hero:${hero.id}`) * scale;
      actor.sprite.setScale(scale).setPosition(x + recoil, y).setFlipX(false).setDepth(4 + y / 1000);
      actor.shadow.follow(x, y, 36 * scale);
      if (!hero.alive || actor.deathPlayed) {
        if (!actor.deathPlayed) {
          this.juice.release(actor.sprite);
          actor.shadow.fade();
          this.fadeCorpse(actor.sprite);
          actor.attackUntil = 0;
          actor.sprite.anims.timeScale = 1;
          actor.sprite.play(heroAnimationKey(hero.id, "death"));
        }
        actor.deathPlayed = true;
      } else if (attacks.has(hero.id)) {
        // Let a finishing strike land, then resume the run without an idle reset.
        const timing = heroAttackTiming(hero.id);
        const speed = effectiveAttackSpeed(hero.attackSpeed, hero.classId, hero.skillBuffRemaining);
        actor.attackUntil = this.visualTime + attackDuration(timing.fps, speed) * 1000;
        actor.sprite.anims.timeScale = attackPlaybackScale(timing.fps, speed);
        actor.sprite.play(heroAnimationKey(hero.id, "attack"));
      } else {
        if (hero.state === "running")
          actor.attackUntil = Math.min(actor.attackUntil, this.visualTime + 170);
        if (this.visualTime >= actor.attackUntil) {
          const motion = hero.state === "running" || hero.state === "chasing" ? "run" : "idle";
          const key = heroAnimationKey(hero.id, motion);
          if (actor.sprite.anims.currentAnim?.key !== key) {
            actor.sprite.anims.timeScale = 1;
            actor.sprite.play(key);
          }
        }
      }
    }
  }

  private showCombatFeedback(enemies: readonly RuntimeEnemy[],
    before: ReadonlyMap<number, { hp: number; worldX: number; boss: boolean; visual: string; formationIndex: number }>,
    beforeHeroes: ReadonlyMap<string, number>, events: readonly RunEvent[], w: number, groundY: number): void {
    const current = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    const scale = Math.min(1, Math.max(0.7, battleHeight(this.getRenderSize().cssHeight) / 320));
    const hits = events.filter((e): e is Extract<RunEvent, { type: "enemyHit" }> =>
      e.type === "enemyHit" && e.damage > 0);
    const held = new Set<Phaser.GameObjects.Sprite>();
    let holdMs = 0;
    let bossImpact = false;
    for (const [id, old] of before) {
      const targetHits = hits.filter((e) => e.id === id);
      if (!targetHits.length) continue;
      const hit = targetHits.find((e) => hitProfile(e.source, e.skillId, old.boss).heavy) ?? targetHits[0]!;
      const profile = hitProfile(hit.source, hit.skillId, old.boss);
      const attackerX = this.world.heroWorldX(hit.attackerId);
      const direction = Math.sign(old.worldX - attackerX) || 1;
      const visual = ENEMY_VISUALS[old.visual as EnemyVisualID] ?? ENEMY_VISUALS.goblin1;
      const worldX = old.worldX + (visual.contactOffsetPx + enemyGroundSlot(old.formationIndex).x) *
        scale / PIXELS_PER_WORLD_METRE;
      const groundOffset = enemyGroundSlot(old.formationIndex).y - (old.boss ? 86 : 54);
      const sparks = this.juice.hit(`enemy:${id}`, profile, direction);
      // Skill impact shapes already provide the primary contact flash and sparks.
      const skillBurstHere = events.some((e) => e.type === "skillImpact" && e.targetId === id);
      if (sparks && !skillBurstHere) this.juice.impact(worldX, groundOffset, profile, direction, old.boss);
      const remaining = current.get(id)?.hp ?? 0;
      this.juice.number(worldX, groundOffset - 14, old.hp - remaining, profile.color, profile.heavy);
      if (profile.holdMs) {
        holdMs = Math.max(holdMs, profile.holdMs);
        bossImpact ||= old.boss;
        const target = this.enemyActors.get(id)?.sprite;
        const attacker = this.actors.get(hit.attackerId)?.sprite;
        if (target && remaining > 0) held.add(target);
        if (attacker) held.add(attacker);
      }
    }
    if (holdMs) { this.juice.hold([...held], holdMs); this.juice.shake(bossImpact); }
    for (const hero of this.session.run.heroes) {
      const hurt = events.filter((e): e is Extract<RunEvent, { type: "enemyAttacked" }> =>
        e.type === "enemyAttacked" && e.targetId === hero.id && e.damage > 0);
      if (!hurt.length) continue;
      const attacker = hurt[0]!;
      const old = before.get(attacker.id);
      const worldX = this.world.heroWorldX(hero.id);
      const direction = Math.sign(worldX - (old?.worldX ?? this.world.enemyWorldX(attacker.id))) || -1;
      const profile = { ...hitProfile("MELEE", undefined, false), color: 0xffb7a5, recoilPx: old?.boss ? 4 : 3 };
      if (this.juice.hit(`hero:${hero.id}`, profile, direction))
        this.juice.impact(worldX, -62, profile, direction, false);
      this.juice.number(worldX, -85, (beforeHeroes.get(hero.id) ?? hero.hp) - hero.hp, 0xff9b8b);
    }
    for (const event of events) {
      if (event.type === "skillActivated") {
        const hero = this.session.run.heroes.find((entry) => entry.id === event.id);
        if (!hero) continue;
        const x = projectWorldX(this.world.heroWorldX(hero.id), this.world.cameraWorldX, w);
        const burst = skillBurst(this, event.skillId, x, groundY - 61 * scale, false, this.reducedMotion);
        this.trackSkillBurst(burst, this.world.heroWorldX(hero.id), -61);
      } else if (event.type === "skillImpact") {
        const old = before.get(event.targetId);
        const meteorActor = [...this.projectileActors.values()].find((actor) =>
          actor.type === "METEOR_FIREBALL" && actor.targetId === event.targetId);
        const worldX = event.skillId === COMBAT_SKILLS.Mage.id && meteorActor
          ? meteorActor.toWorldX : old?.worldX ?? this.world.enemyWorldX(event.targetId);
        const groundOffset = enemyGroundSlot(old?.formationIndex ?? 0).y - (old?.boss ? 86 : 54);
        const x = projectWorldX(worldX, this.world.cameraWorldX, w);
        const burst = skillBurst(this, event.skillId, x, groundY + groundOffset * scale, true, this.reducedMotion);
        this.trackSkillBurst(burst, worldX, groundOffset);
        if (event.skillId === COMBAT_SKILLS.Mage.id) {
          const groundFire = meteorGroundFire(this, x, groundY);
          this.juice.track(groundFire, worldX, enemyGroundSlot(old?.formationIndex ?? 0).y,
            this.reducedMotion ? 120 : 650, 1.2);
        }
      } else if (event.type === "encounterStarted" && event.boss) {
        this.spawnBossWarning(w / 2, groundY - 130);
      }
    }
  }

  private trackSkillBurst(burst: { effect: Phaser.GameObjects.Graphics; duration: number; scale: number },
    worldX: number, groundOffset: number): void {
    this.juice.track(burst.effect, worldX, groundOffset, burst.duration, burst.scale);
  }

  private fadeCorpse(sprite: Phaser.GameObjects.Sprite, after?: () => void): void {
    // Preserve all twelve death frames, then shrink only the final enemy pose.
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({ targets: sprite, alpha: 0,
        ...(after ? { scaleX: sprite.scaleX * 0.88, scaleY: sprite.scaleY * 0.88 } : {}),
        duration: this.reducedMotion ? 80 : 220,
        onComplete: () => { if (after) { sprite.destroy(); after(); } } });
    });
  }

  private spawnBossWarning(x: number, y: number): void {
    const label = this.add.text(x, y, "BOSS ENCOUNTER", {
      fontFamily: "Georgia, serif", fontSize: "24px", fontStyle: "bold",
      color: "#ffe0a0", stroke: "#521e17", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(9);
    this.juice.track(label, this.world.cameraWorldX +
      this.getRenderSize().cssWidth * 0.14 / PIXELS_PER_WORLD_METRE,
      -130, this.reducedMotion ? 200 : 900, 1.08);
  }
}
