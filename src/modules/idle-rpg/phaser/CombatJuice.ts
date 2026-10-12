import Phaser from "phaser";
import { FeedbackThrottle, visualRecoil, type HitProfile } from "../game/hitFeedback";
import { projectWorldX } from "../game/worldPresentation";

interface Anchor { worldX: number; groundOffset: number; offsetX: number;
  born: number; duration: number; rise: number }
interface Reaction { born: number; direction: number; profile: HitProfile }
interface Hold { until: number; speed: number }

const MAX_EFFECTS = 24;
const MAX_NUMBERS = 10;

/** One bounded lifecycle for skill bursts, impact sparks, death dust and damage text. */
export class CombatJuice {
  readonly objects = new Set<Phaser.GameObjects.GameObject>();
  readonly stats = { hits: 0, heavy: 0, holds: 0, deaths: 0 };
  private anchors = new Map<Phaser.GameObjects.GameObject, Anchor>();
  private reactions = new Map<string, Reaction>();
  private sparkAt = new Map<string, number>();
  private holds = new Map<Phaser.GameObjects.Sprite, Hold>();
  private holdThrottle = new FeedbackThrottle();
  private shakeThrottle = new FeedbackThrottle();
  private numberCount = 0;
  private numbers = new Set<Phaser.GameObjects.GameObject>();
  private numberLane = 0;
  private now = 0;
  reducedMotion = false;

  constructor(private readonly scene: Phaser.Scene) {}

  beginFrame(now: number): void {
    this.now = now;
    for (const [sprite, hold] of this.holds) {
      if (sprite.active) sprite.anims.timeScale = hold.speed;
      if (!sprite.active || now >= hold.until) this.holds.delete(sprite);
    }
    for (const [key, reaction] of this.reactions)
      if (now - reaction.born > Math.max(reaction.profile.flashMs, reaction.profile.recoilMs)) {
        this.reactions.delete(key);
        this.sparkAt.delete(key);
      }
  }

  endFrame(): void {
    for (const [sprite, hold] of this.holds) {
      if (!sprite.active) { this.holds.delete(sprite); continue; }
      hold.speed = sprite.anims.timeScale;
      sprite.anims.timeScale = 0;
    }
  }

  hit(key: string, profile: HitProfile, direction: number): boolean {
    this.stats.hits++;
    if (profile.heavy) this.stats.heavy++;
    // Replace the reaction rather than stacking offsets or timers on rapid hits.
    this.reactions.set(key, { born: this.now, direction: Math.sign(direction) || 1, profile });
    const last = this.sparkAt.get(key) ?? -Infinity;
    if (this.now - last < 65) return false;
    this.sparkAt.set(key, this.now);
    return true;
  }

  apply(sprite: Phaser.GameObjects.Sprite, key: string): number {
    const reaction = this.reactions.get(key);
    if (!reaction) { sprite.clearTint(); return 0; }
    const age = this.now - reaction.born;
    if (age < reaction.profile.flashMs) {
      const color = age < 28 ? 0xffffff : reaction.profile.heavy ? 0xffc9a1 : 0xffc3bd;
      sprite.setTint(color).setTintMode(Phaser.TintModes.FILL);
    } else sprite.clearTint();
    return this.reducedMotion ? 0 : reaction.direction * visualRecoil(age, reaction.profile);
  }

  hold(sprites: readonly (Phaser.GameObjects.Sprite | undefined)[], duration: number): void {
    if (this.reducedMotion || !duration || !this.holdThrottle.take(this.now, 160)) return;
    this.stats.holds++;
    for (const sprite of sprites) {
      if (!sprite?.active || this.holds.has(sprite)) continue;
      this.holds.set(sprite, { until: this.now + duration, speed: sprite.anims.timeScale });
    }
  }

  release(sprite: Phaser.GameObjects.Sprite): void {
    const hold = this.holds.get(sprite);
    if (hold && sprite.active) sprite.anims.timeScale = hold.speed;
    this.holds.delete(sprite);
  }

  shake(boss: boolean): void {
    if (!this.reducedMotion && this.shakeThrottle.take(this.now, 300))
      this.scene.cameras.main.shake(boss ? 70 : 55, boss ? 0.001 : 0.0006);
  }

  track(effect: Phaser.GameObjects.GameObject, worldX: number, groundOffset: number,
    duration: number, scale: number, rise = 0, offsetX = 0): void {
    if (this.objects.size >= MAX_EFFECTS) { effect.destroy(); return; }
    this.objects.add(effect);
    this.anchors.set(effect, { worldX, groundOffset, offsetX, born: this.now, duration, rise });
    this.scene.tweens.add({ targets: effect, alpha: 0, scale, duration,
      onComplete: () => {
        effect.destroy();
        this.objects.delete(effect);
        this.anchors.delete(effect);
        if (this.numbers.delete(effect)) this.numberCount--;
      } });
  }

  project(cameraWorldX: number, width: number, groundY: number, scale: number): void {
    for (const [effect, anchor] of this.anchors) {
      const rise = anchor.rise * Math.min(1, (this.now - anchor.born) / anchor.duration);
      (effect as Phaser.GameObjects.Graphics).setPosition(
        projectWorldX(anchor.worldX, cameraWorldX, width) + anchor.offsetX * scale,
        groundY + (anchor.groundOffset - rise) * scale);
    }
  }

  impact(worldX: number, groundOffset: number, profile: HitProfile, direction: number,
    boss: boolean): void {
    if (this.objects.size >= MAX_EFFECTS) return;
    const g = this.scene.add.graphics().setDepth(8);
    const radius = profile.heavy ? 24 : 12;
    g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, profile.heavy ? 6 : 3);
    g.lineStyle(profile.heavy ? 3 : 2, profile.color, 0.95);
    for (let i = 0; i < (profile.heavy ? 7 : 4); i++) {
      const angle = -1.5 + i * 3 / (profile.heavy ? 6 : 3);
      const dx = Math.cos(angle) * (direction || 1);
      const dy = Math.sin(angle);
      g.lineBetween(dx * 5, dy * 5, dx * radius, dy * radius);
    }
    if (profile.heavy && boss) {
      g.lineStyle(3, 0xffd38c, 0.85).strokeEllipse(0, 43, 70, 13);
      g.lineStyle(2, profile.color, 0.6).strokeCircle(0, 0, 29);
    }
    this.track(g, worldX, groundOffset, this.reducedMotion ? 85 : profile.heavy ? 200 : 135,
      profile.heavy ? 1.35 : 1.2);
  }

  death(worldX: number, groundOffset: number, boss: boolean): void {
    this.stats.deaths++;
    if (this.objects.size >= MAX_EFFECTS) return;
    const g = this.scene.add.graphics().setDepth(5.9);
    const radius = boss ? 28 : 16;
    g.lineStyle(2, 0xffd59b, 0.85).strokeEllipse(0, -18, radius, radius * 0.7);
    for (let i = 0; i < (boss ? 8 : 5); i++) {
      const angle = i * Math.PI * 2 / (boss ? 8 : 5);
      g.fillStyle(i % 2 ? 0xffd494 : 0xbd9365, 0.8).fillRect(
        Math.cos(angle) * radius, -20 + Math.sin(angle) * radius, 3, 3);
    }
    g.lineStyle(boss ? 3 : 2, 0xc9b18a, 0.45).strokeEllipse(0, 0, radius * 2, radius * 0.4);
    this.track(g, worldX, groundOffset, this.reducedMotion ? 100 : 280, boss ? 1.6 : 1.4);
  }

  number(worldX: number, groundOffset: number, amount: number, color: number, heavy = false): void {
    if (amount <= 0 || this.numberCount >= MAX_NUMBERS || this.objects.size >= MAX_EFFECTS) return;
    const lane = this.numberLane++ % 3;
    const label = this.scene.add.text(0, 0, String(Math.ceil(amount)), {
      fontFamily: "Georgia, serif", fontSize: heavy ? "22px" : "17px", fontStyle: "bold",
      color: `#${color.toString(16).padStart(6, "0")}`, stroke: "#211711", strokeThickness: heavy ? 4 : 3,
    }).setOrigin(0.5, 1).setDepth(9);
    this.numberCount++;
    this.numbers.add(label);
    this.track(label, worldX, groundOffset - lane * 7, this.reducedMotion ? 300 : 540,
      1, this.reducedMotion ? 8 : 28, (lane - 1) * 11);
  }

  reset(): void {
    for (const sprite of this.holds.keys()) this.release(sprite);
    for (const effect of this.objects) { this.scene.tweens.killTweensOf(effect); effect.destroy(); }
    this.objects.clear(); this.anchors.clear(); this.reactions.clear(); this.sparkAt.clear();
    this.numbers.clear();
    this.numberCount = 0; this.numberLane = 0;
    Object.assign(this.stats, { hits: 0, heavy: 0, holds: 0, deaths: 0 });
    this.holdThrottle.reset(); this.shakeThrottle.reset();
  }
}
