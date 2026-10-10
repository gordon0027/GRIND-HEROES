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
import { drawHealthBar } from "./healthBars";

const BACKGROUNDS = {
  forest: { key: "grind-stage-meadow-road", file: "meadow-road.png" },
  act2: { key: "grind-stage-orange-bastion", file: "act2.png" },
  act3: { key: "grind-stage-undead-crypt", file: "act3.png" },
} as const;
const BACKGROUND_ASPECT = 3840 / 2160;
const FOREST_TILE_WORLD_METRES = 600;
const ARROW_KEY = "grind-short-willow-arrow";
const ARROW_PATH = `${import.meta.env.BASE_URL}assets/projectiles/ShortWillowBow.png`;
const ARROW_FRAME = 3; // 3 columns x 2 rows: bottom-left is (0, 128, 128, 128).
const ORB_KEY = "grind-mage-red-orb";
const PROJECTILE_SIZE = { ARROW: 32, MAGIC_ORB: 18 } as const;
const PROJECTILE_TARGET_Y = { normal: -55, boss: -85 } as const;
const MAX_FEEDBACK_OBJECTS = 24;

interface HeroActor {
  sprite: Phaser.GameObjects.Sprite;
  attackUntil: number;
  hitUntil: number;
  hitStarted: number;
  deathPlayed: boolean;
}

interface EnemyActor {
  sprite: Phaser.GameObjects.Sprite;
  hitUntil: number;
  hitStarted: number;
}

interface EnemyCorpse {
  sprite: Phaser.GameObjects.Sprite;
  readonly deathWorldX: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly flashUntil: number;
}

interface ProjectileActor {
  sprite: Phaser.GameObjects.Sprite;
  fromWorldX: number;
  toWorldX: number;
}

/** Phaser paints the run; StageRun still owns distance, positions, damage and outcomes. */
export class GrindScene extends Phaser.Scene {
  private enemyPaint?: Phaser.GameObjects.Graphics;
  private heroBars?: Phaser.GameObjects.Graphics;
  private backgroundTiles: Phaser.GameObjects.Image[] = [];
  private actors = new Map<string, HeroActor>();
  private enemyActors = new Map<number, EnemyActor>();
  private corpses = new Map<number, EnemyCorpse>();
  private projectileActors = new Map<number, ProjectileActor>();
  private enemyProjectileActors = new Map<number, ProjectileActor>();
  private feedbackObjects = new Set<Phaser.GameObjects.GameObject>();
  private world = new WorldPresentation();
  private visualTime = 0;
  private lastRun: StageRun | null = null;
  private lastElapsed = 0;
  private reducedMotion = false;
  private numberLane = 0;

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
    for (const visual of Object.values(ENEMY_VISUALS))
      this.load.spritesheet(visual.textureKey, visual.assetPath,
        { frameWidth: visual.frameWidth, frameHeight: visual.frameHeight });
    for (const art of Object.values(BACKGROUNDS))
      this.load.image(art.key, `${import.meta.env.BASE_URL}assets/backgrounds/stages/${art.file}`);
    this.load.spritesheet(ARROW_KEY, ARROW_PATH, { frameWidth: 128, frameHeight: 128 });
  }

  create(): void {
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.syncCameraResolution();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.syncCameraResolution, this);
    registerHeroAnimations(this);
    registerEnemyAnimations(this);
    const orb = this.add.graphics();
    orb.fillStyle(0xff3737, 0.18).fillCircle(12, 12, 12);
    orb.fillStyle(0xe22229, 0.85).fillCircle(12, 12, 7);
    orb.fillStyle(0xffb5a3).fillCircle(10, 10, 3);
    orb.generateTexture(ORB_KEY, 24, 24);
    orb.destroy();
    this.enemyPaint = this.add.graphics().setDepth(3);
    this.heroBars = this.add.graphics().setDepth(7);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.syncCameraResolution, this);
      this.resetActors();
    });
  }

  override update(_time: number, deltaMs: number): void {
    const run = this.session.run;
    if (run !== this.lastRun || run.elapsedSeconds < this.lastElapsed - 0.1) {
      this.resetActors();
      this.world.reset();
    }
    this.lastRun = run;
    const beforeEnemies = new Map(run.enemies.map((e) => [e.id,
      { hp: e.hp, worldX: this.world.enemyWorldX(e.id), boss: e.boss,
        visual: e.visual ?? "goblin1" }] as const));
    const beforeHeroes = new Map(run.heroes.map((h) => [h.id, h.hp] as const));
    const events = this.session.tickRun(deltaMs / 1000);
    const { cssWidth: w, cssHeight } = this.getRenderSize();
    this.world.update(run, deltaMs / 1000, w);
    this.visualTime += Math.max(0, deltaMs);
    this.lastElapsed = run.elapsedSeconds;
    const h = battleHeight(cssHeight);
    const groundY = h * 0.82;
    this.drawBackground(run, w, h, groundY);
    this.drawEnemies(this.world.visibleEnemies(run), events, beforeEnemies, w, groundY, h);
    this.syncHeroes(run.heroes, events, beforeHeroes, w, groundY, h);
    this.syncProjectiles(run.projectiles, run.enemies, w, groundY, h);
    this.syncEnemyProjectiles(run.enemyProjectiles, w, groundY, h);
    this.showCombatFeedback(run.enemies, beforeEnemies, events, w, groundY);
  }

  private resetActors(): void {
    for (const actor of this.actors.values()) actor.sprite.destroy();
    this.actors.clear();
    for (const actor of this.enemyActors.values()) actor.sprite.destroy();
    this.enemyActors.clear();
    for (const corpse of this.corpses.values()) {
      this.tweens.killTweensOf(corpse.sprite);
      corpse.sprite.destroy();
    }
    this.corpses.clear();
    for (const actor of this.projectileActors.values()) actor.sprite.destroy();
    this.projectileActors.clear();
    for (const actor of this.enemyProjectileActors.values()) actor.sprite.destroy();
    this.enemyProjectileActors.clear();
    for (const effect of this.feedbackObjects) {
      this.tweens.killTweensOf(effect);
      effect.destroy();
    }
    this.feedbackObjects.clear();
  }

  private syncProjectiles(projectiles: readonly PendingProjectile[], enemies: readonly RuntimeEnemy[],
    width: number, groundY: number, battleH: number): void {
    const active = new Set(projectiles.filter((shot) => shot.elapsed >= 0).map((shot) => shot.id));
    for (const [id, actor] of this.projectileActors) {
      if (active.has(id)) continue;
      actor.sprite.destroy();
      this.projectileActors.delete(id);
    }
    const battleScale = Math.min(1, Math.max(0.7, battleH / 320));
    for (const shot of projectiles) {
      if (shot.elapsed < 0) continue; // The attack animation has not released it yet.
      let actor = this.projectileActors.get(shot.id);
      const visual = HERO_VISUALS[shot.attackerId];
      const origin = visual?.projectileOrigin;
      const enemy = enemies.find((entry) => entry.id === shot.targetId);
      if (!actor) {
        const fromWorldX = this.world.heroWorldX(shot.attackerId) +
          (origin?.x ?? 0) * (visual?.scale ?? 1) * battleScale / PIXELS_PER_WORLD_METRE;
        const enemyVisual = enemy?.visual && enemy.visual in ENEMY_VISUALS
          ? ENEMY_VISUALS[enemy.visual as EnemyVisualID] : ENEMY_VISUALS.goblin1;
        const toWorldX = this.world.enemyWorldX(shot.targetId) +
          enemyVisual.contactOffsetPx * battleScale / PIXELS_PER_WORLD_METRE;
        const texture = shot.type === "ARROW" ? ARROW_KEY : ORB_KEY;
        if (!this.textures.exists(texture)) continue;
        const sprite = this.add.sprite(0, 0, texture, shot.type === "ARROW" ? ARROW_FRAME : undefined)
          .setDisplaySize(PROJECTILE_SIZE[shot.type] * battleScale,
            PROJECTILE_SIZE[shot.type] * battleScale).setDepth(6);
        actor = { sprite, fromWorldX, toWorldX };
        this.projectileActors.set(shot.id, actor);
      }
      const progress = Math.min(1, Math.max(0, shot.elapsed / shot.travelDuration));
      const fromX = projectWorldX(actor.fromWorldX, this.world.cameraWorldX, width);
      const toX = projectWorldX(actor.toWorldX, this.world.cameraWorldX, width);
      const fromY = groundY + (visual?.offsetY ?? 0) +
        (origin?.y ?? -40) * (visual?.scale ?? 1) * battleScale;
      const toY = groundY + (enemy?.boss ? PROJECTILE_TARGET_Y.boss : PROJECTILE_TARGET_Y.normal) * battleScale;
      const x = fromX + (toX - fromX) * progress;
      const y = fromY + (toY - fromY) * progress;
      actor.sprite.setDisplaySize(PROJECTILE_SIZE[shot.type] * battleScale,
        PROJECTILE_SIZE[shot.type] * battleScale).setPosition(x, y);
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
        const sprite = this.add.sprite(0, 0, ARROW_KEY, ARROW_FRAME)
          .setDisplaySize(25 * scale, 25 * scale).setDepth(6)
          .setTint(this.session.run.stage.chapter === 3 ? 0xb4d8d8 : 0xffba7b);
        actor = { sprite,
          fromWorldX: this.world.enemyWorldX(shot.attackerId) - 12 * scale / PIXELS_PER_WORLD_METRE,
          toWorldX: this.world.heroWorldX(shot.targetId),
        };
        this.enemyProjectileActors.set(shot.id, actor);
      }
      actor.sprite.setVisible(shot.elapsed >= 0);
      if (shot.elapsed < 0) continue;
      const progress = Math.min(1, Math.max(0, shot.elapsed / shot.travelDuration));
      const fromX = projectWorldX(actor.fromWorldX, this.world.cameraWorldX, width);
      const toX = projectWorldX(actor.toWorldX, this.world.cameraWorldX, width);
      const fromY = groundY - 60 * scale;
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
    before: ReadonlyMap<number, { hp: number; worldX: number; boss: boolean; visual: string }>,
    w: number, groundY: number, battleH: number): void {
    const g = this.enemyPaint!;
    for (const corpse of this.corpses.values()) {
      corpse.sprite.setPosition(projectWorldX(corpse.deathWorldX, this.world.cameraWorldX, w) +
        corpse.offsetX, groundY + corpse.offsetY);
      if (this.visualTime < corpse.flashUntil) corpse.sprite.setTint(0xffb4b4);
      else corpse.sprite.clearTint();
    }
    const active = new Set(enemies.map((enemy) => enemy.id));
    const defeated = new Set(events.filter((e) => e.type === "enemyDefeated").map((e) => e.id));
    for (const [id, actor] of this.enemyActors) {
      if (active.has(id)) continue;
      this.enemyActors.delete(id);
      if (defeated.has(id)) {
        const old = before.get(id);
        const visual = actor.sprite.getData("visual") as EnemyVisualID;
        if (!old) { actor.sprite.destroy(); continue; }
        const scale = Math.min(1, Math.max(0.7, battleH / 320));
        const offsetX = ENEMY_VISUALS[visual].contactOffsetPx * scale +
          (id % 2 ? 2 : -2);
        const offsetY = ENEMY_VISUALS[visual].offsetY + (id % 2 ? 2 : -2);
        this.corpses.set(id, { sprite: actor.sprite, deathWorldX: old.worldX,
          offsetX, offsetY, flashUntil: this.visualTime + (old.boss ? 120 : 90) });
        actor.sprite.setPosition(projectWorldX(old.worldX, this.world.cameraWorldX, w) +
          offsetX, groundY + offsetY).setTint(0xffb4b4);
        this.spawnDeathBurst(actor.sprite.x, groundY - (old.boss ? 88 : 52), old.boss);
        this.fadeCorpse(actor.sprite);
        actor.sprite.anims.timeScale = 1;
        actor.sprite.play(enemyAnimationKey(visual, "death"));
        actor.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          this.tweens.killTweensOf(actor.sprite);
          actor.sprite.destroy();
          this.corpses.delete(id);
        });
      } else actor.sprite.destroy();
    }
    // A very fast kill can occur on the same frame that the enemy first enters view.
    for (const id of defeated) {
      if (this.corpses.has(id)) continue;
      const old = before.get(id);
      if (!old) continue;
      const visualID = old.visual in ENEMY_VISUALS ? old.visual as EnemyVisualID : "goblin1";
      const visual = ENEMY_VISUALS[visualID];
      if (!this.textures.exists(visual.textureKey)) continue;
      const scale = Math.min(1, Math.max(0.7, battleH / 320));
      const offsetX = visual.contactOffsetPx * scale + (id % 2 ? 2 : -2);
      const offsetY = visual.offsetY + (id % 2 ? 2 : -2);
      const sprite = this.add.sprite(
        projectWorldX(old.worldX, this.world.cameraWorldX, w) + offsetX,
        groundY + offsetY, visual.textureKey, visual.frames.death.start,
      ).setOrigin(visual.originX, visual.originY).setScale(visual.scale * scale).setDepth(4);
      this.corpses.set(id, { sprite, deathWorldX: old.worldX, offsetX, offsetY,
        flashUntil: this.visualTime + (old.boss ? 120 : 90) });
      sprite.setTint(0xffb4b4);
      this.spawnDeathBurst(sprite.x, groundY - (old.boss ? 88 : 52), old.boss);
      this.fadeCorpse(sprite);
      sprite.play(enemyAnimationKey(visualID, "death"));
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.tweens.killTweensOf(sprite);
        sprite.destroy();
        this.corpses.delete(id);
      });
    }
    const attacks = new Set(events.filter((e) => e.type === "enemyAttackStarted").map((e) => e.id));
    for (const enemy of enemies) {
      const visualID = enemy.visual in ENEMY_VISUALS ? enemy.visual as EnemyVisualID : "goblin1";
      const visual = ENEMY_VISUALS[visualID];
      if (!visual || !this.textures.exists(visual.textureKey)) continue;
      const battleScale = Math.min(1, Math.max(0.7, battleH / 320));
      const x = projectWorldX(enemy.worldX, this.world.cameraWorldX, w) +
        visual.contactOffsetPx * battleScale + (enemy.id % 2 ? 2 : -2);
      let actor = this.enemyActors.get(enemy.id);
      if (!actor) {
        const sprite = this.add.sprite(x, groundY, visual.textureKey, visual.frames.run.start)
          .setOrigin(visual.originX, visual.originY).setDepth(4).setData("visual", visualID);
        actor = { sprite, hitUntil: 0, hitStarted: 0 };
        this.enemyActors.set(enemy.id, actor);
      }
      const scale = visual.scale * battleScale;
      if ((before.get(enemy.id)?.hp ?? enemy.hp) > enemy.hp) {
        actor.hitStarted = this.visualTime;
        actor.hitUntil = this.visualTime + (enemy.boss ? 120 : 90);
      }
      const recoil = Math.max(0, 1 - (this.visualTime - actor.hitStarted) / 100) *
        (enemy.boss ? 5 : 3);
      actor.sprite.setScale(scale).setPosition(x + recoil, groundY + visual.offsetY +
        (enemy.id % 2 ? 2 : -2)).setFlipX(false);
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
      if (this.visualTime < actor.hitUntil) actor.sprite.setTint(0xffa1a1);
      else actor.sprite.clearTint();
      const width = enemy.boss ? 110 : 48;
      // The top HUD covers a tall boss's head; put its wider bar below the feet.
      const barY = enemy.boss ? groundY + 6 : groundY - 110 * scale;
      drawHealthBar(g, x, barY, width, enemy.hp / enemy.maxHp, enemy.boss ? "boss" : "enemy");
    }
  }

  private syncHeroes(heroes: readonly RuntimeHero[], events: readonly RunEvent[],
    beforeHeroes: ReadonlyMap<string, number>, w: number,
    groundY: number, battleH: number): void {
    const active = new Set(heroes.map((hero) => hero.id));
    for (const [id, actor] of this.actors) {
      if (active.has(id)) continue;
      actor.sprite.destroy();
      this.actors.delete(id);
    }
    const attacks = new Set(events.filter((e) => e.type === "heroAttacked").map((e) => e.id));
    const bars = this.heroBars!;
    bars.clear();
    for (const hero of heroes) {
      const visual = HERO_VISUALS[hero.id];
      const x = projectWorldX(this.world.heroWorldX(hero.id), this.world.cameraWorldX, w);
      const y = groundY + (visual?.offsetY ?? 0);
      if (!visual || !this.textures.exists(visual.textureKey)) {
        this.enemyPaint!.fillStyle(hero.alive ? heroArchetype(hero.id).color : 0x65718a)
          .fillRoundedRect(x - 18, y - 58, 36, 58, 5);
        continue;
      }
      let actor = this.actors.get(hero.id);
      if (!actor) {
        const sprite = this.add.sprite(x, y, visual.textureKey, visual.frames.idle.start)
          .setOrigin(visual.originX, visual.originY).setDepth(5);
        actor = { sprite, attackUntil: 0, hitUntil: 0, hitStarted: 0, deathPlayed: false };
        this.actors.set(hero.id, actor);
      }
      const scale = visual.scale * Math.min(1, Math.max(0.7, battleH / 320));
      if ((beforeHeroes.get(hero.id) ?? hero.hp) > hero.hp) {
        actor.hitStarted = this.visualTime;
        actor.hitUntil = this.visualTime + 95;
        this.floatNumber(x, y - 80 * scale, beforeHeroes.get(hero.id)! - hero.hp, 0xff8e8e);
      }
      const recoil = Math.max(0, 1 - (this.visualTime - actor.hitStarted) / 100) * 3;
      actor.sprite.setScale(scale).setPosition(x - recoil, y);
      if (!hero.alive || actor.deathPlayed) {
        if (!actor.deathPlayed) {
          actor.attackUntil = 0;
          actor.sprite.anims.timeScale = 1;
          actor.sprite.play(heroAnimationKey(hero.id, "death"));
        }
        actor.deathPlayed = true;
      } else if (attacks.has(hero.id)) {
        // Let a finishing strike land, then resume the run without an idle reset.
        const timing = heroAttackTiming(hero.id);
        actor.attackUntil = this.visualTime + attackDuration(timing.fps, hero.attackSpeed) * 1000;
        actor.sprite.anims.timeScale = attackPlaybackScale(timing.fps, hero.attackSpeed);
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
      if (this.visualTime < actor.hitUntil) actor.sprite.setTint(0xff9b9b);
      else actor.sprite.clearTint();
      const barY = y - 135 * scale;
      drawHealthBar(bars, x, barY, 46, hero.hp / hero.maxHp, "hero");
    }
  }

  private showCombatFeedback(enemies: readonly RuntimeEnemy[],
    before: ReadonlyMap<number, { hp: number; worldX: number; boss: boolean; visual: string }>,
    events: readonly RunEvent[], w: number, groundY: number): void {
    const current = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    for (const [id, old] of before) {
      const remaining = current.get(id)?.hp ?? 0;
      if (remaining >= old.hp) continue;
      this.floatNumber(projectWorldX(old.worldX, this.world.cameraWorldX, w),
        groundY - (old.boss ? 90 : 65),
        old.hp - remaining, 0xffebae);
    }
    for (const event of events) {
      if (event.type === "enemyHit") {
        const enemy = current.get(event.id);
        const old = before.get(event.id);
        if (!old) continue;
        const visual = ENEMY_VISUALS[(enemy?.visual ?? old.visual) as EnemyVisualID] ??
          ENEMY_VISUALS.goblin1;
        const x = projectWorldX(old.worldX, this.world.cameraWorldX, w) +
          visual.contactOffsetPx;
        this.spawnImpact(x, groundY - (old.boss ? 90 : 54), event.source, old.boss);
      } else if (event.type === "encounterStarted" && event.boss) {
        this.spawnBossWarning(w / 2, groundY - 130);
      } else if (event.type === "enemyAttacked") {
        const boss = current.get(event.id)?.boss ?? before.get(event.id)?.boss;
        if (boss) this.cameras.main.shake(55, 0.0008);
      }
    }
  }

  private spawnImpact(x: number, y: number,
    source: "MELEE" | "ARROW" | "MAGIC_ORB", boss: boolean): void {
    if (this.feedbackObjects.size >= MAX_FEEDBACK_OBJECTS) return;
    const color = source === "MAGIC_ORB" ? 0xff6262 :
      source === "ARROW" ? 0xffd889 : 0xfff1c2;
    const effect = this.add.graphics({ x, y }).setDepth(8);
    if (source === "MELEE") {
      // A forward slash and a few short sparks point back toward the attacker.
      effect.lineStyle(boss ? 5 : 3, 0xfff4d5, 0.95);
      effect.lineBetween(-18, 15, 13, -17);
      effect.lineStyle(2, color, 0.85);
      effect.lineBetween(-23, 11, 8, -22);
      effect.lineBetween(-6, -3, -17, -14);
      effect.lineBetween(3, 3, 17, 11);
    } else if (source === "ARROW") {
      effect.fillStyle(0xffffff, 0.9).fillCircle(0, 0, 3);
      effect.lineStyle(2, color, 0.9);
      effect.lineBetween(-10, -8, -3, -2);
      effect.lineBetween(3, -3, 11, -11);
      effect.lineBetween(3, 2, 10, 7);
      effect.lineBetween(-4, 3, -9, 10);
    } else {
      effect.fillStyle(color, 0.16).fillCircle(0, 0, boss ? 26 : 18);
      effect.lineStyle(boss ? 4 : 3, color, 0.9).strokeCircle(0, 0, boss ? 17 : 12);
      effect.fillStyle(0xfff2d6, 0.9).fillCircle(0, 0, 4);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        effect.fillStyle(color, 0.85).fillCircle(Math.cos(angle) * 20, Math.sin(angle) * 20, 2);
      }
    }
    if (boss) effect.lineStyle(2, 0xffa65a, 0.7).strokeCircle(0, 0, 28);
    this.animateFeedback(effect, this.reducedMotion ? 90 : 190, boss ? 1.6 : 1.35);
  }

  private fadeCorpse(sprite: Phaser.GameObjects.Sprite): void {
    if (this.reducedMotion) return;
    this.tweens.add({ targets: sprite, alpha: 0, delay: 360, duration: 310,
      ease: "Sine.easeIn" });
  }

  private spawnDeathBurst(x: number, y: number, boss: boolean): void {
    if (this.feedbackObjects.size >= MAX_FEEDBACK_OBJECTS) return;
    const burst = this.add.graphics({ x, y }).setDepth(8);
    const radius = boss ? 31 : 18;
    burst.lineStyle(boss ? 3 : 2, boss ? 0xffcc72 : 0xffd59b, 0.9);
    burst.strokeCircle(0, 0, radius * 0.55);
    for (let i = 0; i < (boss ? 10 : 6); i++) {
      const angle = i * Math.PI * 2 / (boss ? 10 : 6);
      burst.lineBetween(Math.cos(angle) * radius * 0.6, Math.sin(angle) * radius * 0.6,
        Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    this.animateFeedback(burst, this.reducedMotion ? 100 : boss ? 380 : 250,
      boss ? 1.9 : 1.5);
  }

  private spawnBossWarning(x: number, y: number): void {
    if (this.feedbackObjects.size >= MAX_FEEDBACK_OBJECTS) return;
    const label = this.add.text(x, y, "BOSS ENCOUNTER", {
      fontFamily: "Georgia, serif", fontSize: "24px", fontStyle: "bold",
      color: "#ffe0a0", stroke: "#521e17", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(9);
    this.animateFeedback(label, this.reducedMotion ? 200 : 900, 1.08);
  }

  private animateFeedback(effect: Phaser.GameObjects.GameObject,
    duration: number, scale: number): void {
    this.feedbackObjects.add(effect);
    this.tweens.add({ targets: effect, alpha: 0, scale, duration,
      onComplete: () => {
        effect.destroy();
        this.feedbackObjects.delete(effect);
      } });
  }

  private floatNumber(x: number, y: number, amount: number, color: number): void {
    if (amount <= 0 || this.feedbackObjects.size >= MAX_FEEDBACK_OBJECTS) return;
    const lane = this.numberLane++ % 3;
    const label = this.add.text(x + (lane - 1) * 13, y - lane * 8, String(Math.ceil(amount)), {
      fontFamily: "sans-serif", fontSize: "16px", fontStyle: "bold",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#202030", strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(9);
    this.feedbackObjects.add(label);
    this.tweens.add({ targets: label, y: y - 26, alpha: 0, duration: 550,
      onComplete: () => {
        label.destroy();
        this.feedbackObjects.delete(label);
      } });
  }
}
