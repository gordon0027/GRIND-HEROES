import Phaser from "phaser";
import { HERO_X, type BattleEvent, type Monster } from "../game/battle";
import { formatBig } from "../game/format";
import type { IdleSession } from "../game/session";
import { stageInfo, type Theme } from "../game/stages";
import { LANE_MAX_PX, battleHeight } from "../layout";
import {
  HERO_SIZE,
  MONSTER_SIZE,
  bakeCommon,
  heroColor,
  heroTexture,
  monsterTexture,
  shade,
  shotTexture,
} from "./art";
import { drawHealthBar } from "./healthBars";

// Draws the fight the session simulates: it owns no rules. Each frame it advances the session's
// battle, turns the returned events into effects (numbers, coins, bursts) and moves the sprites to
// where the simulation says things are. The field is the top part of the canvas (layout.ts); the
// Enhance panel covers the rest.

interface MonsterView {
  body: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  wobble: number;
  boss: boolean;
}

const SHOT_Y = 0.52; // of the hero's height above the ground

export class BattleScene extends Phaser.Scene {
  private field = {
    w: 480,
    h: 360,
    laneLeft: 0,
    laneW: 480,
    ground: 290,
    unit: 1,
  };
  private sky?: Phaser.GameObjects.Graphics;
  private hills?: Phaser.GameObjects.Graphics;
  private clouds: Phaser.GameObjects.Image[] = [];
  private theme: Theme | null = null;
  private hero?: Phaser.GameObjects.Image;
  private heroKey = "";
  private heroBar?: Phaser.GameObjects.Graphics;
  private monsters = new Map<number, MonsterView>();
  private shots = new Map<number, Phaser.GameObjects.Image>();
  private sparks?: Phaser.GameObjects.Particles.ParticleEmitter;
  private puffs?: Phaser.GameObjects.Particles.ParticleEmitter;
  private heals?: Phaser.GameObjects.Particles.ParticleEmitter;
  private fire?: Phaser.GameObjects.Particles.ParticleEmitter;
  private frenzyTween?: Phaser.Tweens.Tween;
  private lastCollectAt = 0;
  /** Pixels the hero is pushed back by its own shot; decays every frame. */
  private recoil = 0;

  constructor(private readonly session: IdleSession) {
    super("idle-battle");
  }

  create(): void {
    bakeCommon(this);
    this.sky = this.add.graphics().setDepth(0);
    this.hills = this.add.graphics().setDepth(2);
    for (let i = 0; i < 4; i++)
      this.clouds.push(
        this.add.image(0, 0, "cloud").setDepth(1).setAlpha(0.85),
      );
    this.heroBar = this.add.graphics().setDepth(30);

    const particles = (
      texture: string,
      config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
    ) =>
      this.add
        .particles(0, 0, texture, { emitting: false, ...config })
        .setDepth(40);
    this.sparks = particles("spark", {
      speed: { min: 80, max: 260 },
      lifespan: 420,
      scale: { start: 0.9, end: 0 },
      tint: [0xffffff, 0xffe27a, 0xffa53d],
    });
    this.puffs = particles("puff", {
      speed: { min: 30, max: 120 },
      lifespan: 520,
      scale: { start: 0.9, end: 0.1 },
      alpha: { start: 0.8, end: 0 },
    });
    this.heals = particles("spark", {
      speedY: { min: -140, max: -60 },
      speedX: { min: -40, max: 40 },
      lifespan: 900,
      scale: { start: 1, end: 0 },
      tint: 0x6dff8a,
    });
    this.fire = particles("spark", {
      speed: { min: 120, max: 340 },
      lifespan: 520,
      scale: { start: 1.6, end: 0 },
      tint: [0xff4d1a, 0xffa53d, 0xffe27a],
    });

    this.scale.on("resize", () => this.layout());
    this.layout();
  }

  // ── Layout ─────────────────────────────────────────────────────────────────────────────────

  private layout(): void {
    const w = this.scale.width;
    const h = battleHeight(this.scale.height);
    const laneW = Math.min(w, LANE_MAX_PX);
    this.field = {
      w,
      h,
      laneLeft: (w - laneW) / 2,
      laneW,
      ground: Math.round(h * 0.86),
      // Sprites are drawn for a ~620 px lane; a phone shrinks them so the hero does not cover the
      // melee line, a desktop keeps them at their natural size.
      unit: Math.min(1, Math.max(0.6, laneW / 620)),
    };
    this.theme = null; // repaint the background for the new size
    this.paintBackground();
    this.clouds.forEach((c, i) =>
      c.setPosition(
        ((i + 0.3) / this.clouds.length) * w,
        h * (0.1 + 0.08 * (i % 2)),
      ),
    );
  }

  private laneX(x: number): number {
    return this.field.laneLeft + x * this.field.laneW;
  }

  private paintBackground(): void {
    const theme = stageInfo(this.session.battle.stage).theme;
    if (theme === this.theme || !this.sky || !this.hills) return;
    this.theme = theme;
    const { w, h, ground } = this.field;
    this.cameras.main.setBackgroundColor(theme.sky[0]);

    const sky = this.sky.clear();
    sky.fillGradientStyle(
      theme.sky[0],
      theme.sky[0],
      theme.sky[1],
      theme.sky[1],
      1,
    );
    sky.fillRect(0, 0, w, h);

    const g = this.hills.clear();
    // Far and near hills: rows of overlapping humps.
    g.fillStyle(theme.hillFar, 1);
    for (let x = -40; x < w + 80; x += 90)
      g.fillEllipse(x, ground - 34 + ((x / 90) % 2) * 10, 170, 110);
    g.fillStyle(theme.hillNear, 1);
    for (let x = 10; x < w + 80; x += 120)
      g.fillEllipse(x, ground - 6, 200, 80);
    // Ground with a grass rim, tufts and flowers.
    g.fillStyle(theme.ground, 1);
    g.fillRect(0, ground, w, h - ground + 2);
    g.fillStyle(shade(theme.ground, -0.15), 1);
    for (let x = 0; x < w; x += 46) g.fillRect(x + 12, ground + 14, 18, 4);
    g.fillStyle(theme.grass, 1);
    g.fillRect(0, ground - 4, w, 8);
    for (let x = 4; x < w; x += 26)
      g.fillTriangle(x, ground, x + 6, ground - 12, x + 12, ground);
    const petals = [0xffffff, 0xffd34d, 0xff7aa8];
    for (let i = 0, x = 30; x < w; x += 140, i++) {
      g.fillStyle(petals[i % petals.length]!, 1);
      g.fillCircle(x, ground - 8, 4);
    }
    // A dark strip under the field — the panel starts right below it.
    g.fillStyle(0x000000, 0.25);
    g.fillRect(0, h - 3, w, 3);
  }

  // ── Frame ──────────────────────────────────────────────────────────────────────────────────

  override update(_time: number, deltaMs: number): void {
    const events = this.session.tick(deltaMs / 1000);
    this.paintBackground();
    this.syncHero();
    for (const e of events) this.react(e);
    this.syncMonsters();
    this.syncShots();
    this.driftClouds(deltaMs / 1000);
    const collect = this.session.lastCollect;
    if (collect && collect.at !== this.lastCollectAt) {
      this.lastCollectAt = collect.at;
      this.coinShower(
        Math.min(14, 4 + Math.floor(Math.log10(collect.amount + 1) * 3)),
      );
    }
  }

  private heroPos(): { x: number; y: number } {
    return { x: this.laneX(HERO_X), y: this.field.ground };
  }

  private syncHero(): void {
    const hero = this.session.hero;
    const { x, y } = this.heroPos();
    const key = hero ? heroTexture(this, hero.classID, hero.id) : "";
    if (!this.hero) {
      this.hero = this.add
        .image(x, y, key || "puff")
        .setOrigin(0.5, 1)
        .setDepth(20);
    }
    if (key && key !== this.heroKey) {
      this.heroKey = key;
      this.hero.setTexture(key);
      this.burstAt(this.puffs, x, y - 40, 14);
    }
    this.recoil *= 0.75;
    this.hero.setPosition(x - this.recoil, y);
    // The slime's idle wobble: squash and stretch around its own size.
    const wobble = Math.sin(this.time.now / 260);
    const unit = this.field.unit;
    this.hero.setScale(unit * (1 + 0.04 * wobble), unit * (1 - 0.05 * wobble));
    this.hero.setVisible(!!hero);

    const snap = this.session.battle;
    const bar = this.heroBar!.clear();
    if (!hero || snap.heroDownLeft > 0) return;
    const share = Math.max(0, snap.heroHp / Math.max(1, snap.stats.maxHp));
    const bw = 70;
    const by = y - HERO_SIZE.h * this.field.unit - 4;
    drawHealthBar(bar, x, by, bw, share, "hero");
  }

  private syncMonsters(): void {
    const alive = new Set<number>();
    for (const m of this.session.battle.monsters) {
      alive.add(m.id);
      const view = this.monsters.get(m.id) ?? this.spawnView(m);
      const x = this.laneX(m.x) + Math.sin((m.id * 7.3) % 6.28) * 10;
      const bob = Math.abs(Math.sin(this.time.now / 160 + view.wobble)) * 5;
      view.body.setPosition(x, this.field.ground - bob);
      const share = Math.max(0, m.hp / m.maxHp);
      const bw = view.boss ? 110 : 54;
      const top = this.field.ground - view.body.displayHeight - 8;
      view.bar.clear();
      if (share < 1 || view.boss) {
        drawHealthBar(view.bar, x, top, bw, share, view.boss ? "boss" : "enemy");
      }
    }
    for (const [id, view] of this.monsters)
      if (!alive.has(id)) {
        view.body.destroy();
        view.bar.destroy();
        this.monsters.delete(id);
      }
  }

  private spawnView(m: Monster): MonsterView {
    const body = this.add
      .image(
        this.laneX(m.x),
        this.field.ground,
        monsterTexture(this, m.spec.kind),
      )
      .setOrigin(0.5, 1)
      .setDepth(m.spec.boss ? 18 : 15)
      .setFlipX(true);
    const scale = (m.spec.boss ? 1.6 : 0.8) * this.field.unit;
    body.setScale(0);
    this.tweens.add({
      targets: body,
      scale,
      duration: 260,
      ease: "Back.easeOut",
    });
    const view: MonsterView = {
      body,
      bar: this.add.graphics().setDepth(31),
      wobble: m.id,
      boss: m.spec.boss,
    };
    this.monsters.set(m.id, view);
    return view;
  }

  private syncShots(): void {
    const live = new Set<number>();
    const y = this.field.ground - HERO_SIZE.h * this.field.unit * SHOT_Y;
    for (const p of this.session.battle.projectiles) {
      live.add(p.id);
      let img = this.shots.get(p.id);
      if (!img) {
        const hero = this.session.hero;
        const color = p.crit
          ? 0xff7a1a
          : heroColor(hero?.classID ?? "", hero?.id ?? "");
        img = this.add
          .image(this.laneX(p.x), y, shotTexture(this, color))
          .setDepth(25)
          .setScale(p.crit ? 1.35 : p.extra ? 0.75 : 1);
        this.shots.set(p.id, img);
      }
      img.setPosition(this.laneX(p.x), y + (p.extra ? 10 : 0));
      img.rotation += 0.3;
    }
    for (const [id, img] of this.shots)
      if (!live.has(id)) {
        img.destroy();
        this.shots.delete(id);
      }
  }

  private driftClouds(dt: number): void {
    for (const [i, c] of this.clouds.entries()) {
      c.x -= (6 + i * 3) * dt;
      if (c.x < -100) c.x = this.field.w + 100;
    }
  }

  // ── Effects ────────────────────────────────────────────────────────────────────────────────

  private react(e: BattleEvent): void {
    const { ground } = this.field;
    switch (e.type) {
      case "shoot":
        this.recoil = 7;
        break;
      case "hit": {
        const view = this.monsters.get(e.monsterId);
        const x = view?.body.x ?? this.laneX(e.x);
        const top =
          ground - (view?.body.displayHeight ?? MONSTER_SIZE * 0.7) * 0.75;
        this.floatText(
          formatBig(Math.round(e.damage)),
          x,
          top,
          e.crit ? "crit" : "hit",
        );
        this.burstAt(this.sparks, x - 10, top + 30, e.crit ? 10 : 4);
        if (view) {
          view.body.setTint(0xffb0b0);
          this.time.delayedCall(
            70,
            () => view.body.active && view.body.clearTint(),
          );
        }
        break;
      }
      case "kill": {
        const view = this.monsters.get(e.monsterId);
        const x = view?.body.x ?? this.laneX(e.x);
        this.burstAt(this.puffs, x, ground - 30, e.boss ? 30 : 10);
        this.coinBurst(x, ground - 30, e.boss ? 14 : 3);
        if (e.boss) this.cameras.main.shake(260, 0.012);
        break;
      }
      case "heroHit":
        if (this.hero) {
          const { x } = this.heroPos();
          this.floatText(
            `-${formatBig(Math.round(e.damage))}`,
            x,
            ground - HERO_SIZE.h * this.field.unit,
            "hurt",
          );
          this.hero.setTint(0xff8080);
          this.time.delayedCall(80, () => this.hero?.clearTint());
        }
        break;
      case "dodge": {
        const { x } = this.heroPos();
        this.floatText(
          "MISS",
          x,
          ground - HERO_SIZE.h * this.field.unit,
          "hit",
        );
        break;
      }
      case "heroDown":
        if (this.hero)
          this.tweens.add({
            targets: this.hero,
            alpha: 0.25,
            angle: -80,
            duration: 300,
          });
        this.burstAt(this.puffs, this.heroPos().x, ground - 30, 16);
        break;
      case "heroUp":
        if (this.hero) {
          this.hero.setAlpha(1).setAngle(0);
          this.burstAt(this.heals, this.heroPos().x, ground - 30, 20);
        }
        break;
      case "bossStart":
        this.cameras.main.flash(200, 255, 80, 60);
        break;
      case "stageCleared":
        this.cameras.main.flash(260, 255, 240, 160);
        this.coinBurst(this.field.w / 2, ground - 60, 10);
        break;
      case "skill":
        this.skillFx(e.skill);
        break;
      default:
        break;
    }
  }

  private skillFx(skill: "meteor" | "frenzy" | "heal"): void {
    const { ground } = this.field;
    if (skill === "meteor") {
      for (const [, view] of this.monsters) {
        const tx = view.body.x;
        const m = this.add
          .image(tx + 120, -40, "meteor")
          .setDepth(35)
          .setScale(1.2);
        this.tweens.add({
          targets: m,
          x: tx,
          y: ground - 30,
          duration: 280,
          ease: "Quad.easeIn",
          onComplete: () => {
            this.burstAt(this.fire, tx, ground - 30, 16);
            m.destroy();
          },
        });
      }
      this.cameras.main.shake(200, 0.008);
    } else if (skill === "frenzy" && this.hero) {
      this.frenzyTween?.stop();
      const hero = this.hero;
      hero.setTint(0xffa0a0);
      this.frenzyTween = this.tweens.add({
        targets: hero,
        alpha: 0.75,
        yoyo: true,
        repeat: 11,
        duration: 250,
        onComplete: () => {
          hero.clearTint();
          hero.setAlpha(1);
        },
      });
    } else if (skill === "heal") {
      this.burstAt(this.heals, this.heroPos().x, ground - 40, 26);
    }
  }

  private burstAt(
    emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined,
    x: number,
    y: number,
    count: number,
  ): void {
    emitter?.explode(count, x, y);
  }

  /** Coins pop out of a kill and fly down into the gold counter of the panel. */
  private coinBurst(x: number, y: number, count: number): void {
    const target = { x: this.field.w / 2, y: this.field.h + 24 };
    for (let i = 0; i < count; i++) {
      const coin = this.add.image(x, y, "coin").setDepth(45).setScale(0.9);
      const ox = Phaser.Math.Between(-50, 50);
      const oy = Phaser.Math.Between(-70, -30);
      this.tweens.add({
        targets: coin,
        x: x + ox,
        y: y + oy,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () =>
          this.tweens.add({
            targets: coin,
            x: target.x,
            y: target.y,
            scale: 0.5,
            delay: 120 + i * 30,
            duration: 520,
            ease: "Cubic.easeIn",
            onComplete: () => coin.destroy(),
          }),
      });
    }
  }

  /** The server's collect landed: a shower of coins into the counter. */
  private coinShower(count: number): void {
    for (let i = 0; i < count; i++)
      this.time.delayedCall(i * 40, () =>
        this.coinBurst(
          Phaser.Math.Between(this.field.w * 0.25, this.field.w * 0.85),
          this.field.ground - 50,
          1,
        ),
      );
  }

  private floatText(
    text: string,
    x: number,
    y: number,
    kind: "hit" | "crit" | "hurt",
  ): void {
    const t = this.add
      .text(x + Phaser.Math.Between(-12, 12), y, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: kind === "crit" ? "26px" : "18px",
        fontStyle: "bold",
        color:
          kind === "crit" ? "#ffb02e" : kind === "hurt" ? "#ff5a4f" : "#ffffff",
        stroke: "#2b1d33",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(50);
    if (kind === "crit") t.setScale(1.4);
    this.tweens.add({
      targets: t,
      y: y - 46,
      scale: 1,
      alpha: 0,
      duration: 750,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }
}
