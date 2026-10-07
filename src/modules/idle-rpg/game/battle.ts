// The fight itself — a deterministic simulation with no Phaser in it, so it is tested on its own
// (battle.test.ts) and drawn by the scene from the events each tick returns.
//
// One lane, normalized: the hero stands at HERO_X and shoots right; monsters spawn past the right
// edge, walk to melee range and hit. A stage is WAVES_PER_STAGE waves, then the boss with a timer.
// A failed boss (time out or the hero down) drops back to farming the stage's waves until the player
// challenges it again — the Legend Slime loop.

import type { FighterStats } from "./heroStats";
import {
  BOSS_SECONDS,
  WAVES_PER_STAGE,
  bossMonster,
  waveMonsters,
  type MonsterSpec,
} from "./stages";

export const HERO_X = 0.16;
export const MELEE_X = 0.3;
export const SPAWN_X = 1.08;
/** The hero shoots at monsters closer than this. */
export const RANGE_X = 0.97;
export const PROJECTILE_SPEED = 1.9;
export const SPAWN_GAP_SECONDS = 0.55;
export const RESPAWN_SECONDS = 2.5;
/** The server's MinHitDamage: armor never turns a hit into a heal. */
export const MIN_HIT = 1;

export type SkillId = "meteor" | "frenzy" | "heal";

export interface SkillDef {
  id: SkillId;
  cooldown: number;
  /** How long the effect lasts (0 = instant). */
  duration: number;
  /** Best stage the skill opens at. */
  unlockStage: number;
}

export const SKILLS: SkillDef[] = [
  { id: "meteor", cooldown: 15, duration: 0, unlockStage: 1 },
  { id: "frenzy", cooldown: 22, duration: 6, unlockStage: 3 },
  { id: "heal", cooldown: 28, duration: 0, unlockStage: 6 },
];
/** Meteor hits every monster on screen for this many hero hits. */
export const METEOR_POWER = 4;
export const FRENZY_SPEED = 2;
export const HEAL_SHARE = 0.35;
/** Auto-cast of Heal waits until the hero is this hurt. */
export const AUTO_HEAL_BELOW = 0.55;

export interface Monster {
  id: number;
  spec: MonsterSpec;
  hp: number;
  maxHp: number;
  x: number;
  cooldown: number;
}

export interface Projectile {
  id: number;
  x: number;
  targetId: number;
  damage: number;
  crit: boolean;
  extra: boolean;
}

export type BattleEvent =
  | { type: "spawn"; monster: Monster }
  | { type: "shoot"; projectile: Projectile }
  | { type: "hit"; monsterId: number; x: number; damage: number; crit: boolean }
  | { type: "kill"; monsterId: number; x: number; boss: boolean }
  | { type: "heroHit"; damage: number }
  | { type: "dodge" }
  | { type: "heroDown" }
  | { type: "heroUp" }
  | { type: "waveCleared"; wave: number }
  | { type: "bossStart" }
  | { type: "bossFailed"; reason: "time" | "down" }
  | { type: "stageCleared"; stage: number }
  | { type: "skill"; skill: SkillId };

export interface BattleSnapshot {
  stage: number;
  best: number;
  mode: "waves" | "boss";
  wave: number;
  waves: number;
  bossTimeLeft: number;
  bossHp: number;
  bossMaxHp: number;
  heroHp: number;
  heroMaxHp: number;
  heroDown: boolean;
  monsters: number;
  autoBoss: boolean;
  autoSkills: boolean;
  skills: Array<{
    id: SkillId;
    unlocked: boolean;
    unlockStage: number;
    cooldownLeft: number;
    cooldown: number;
    activeLeft: number;
  }>;
}

/** mulberry32 — a small seeded PRNG, so a test replays the same crits. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IDLE_STATS: FighterStats = {
  maxHp: 100,
  damage: 10,
  armor: 0,
  attackSpeed: 1,
  critChance: 0,
  critMultiplier: 1.5,
  dodge: 0,
  regen: 0,
  multiShot: 0,
};

export class Battle {
  stage = 1;
  best = 1;
  mode: "waves" | "boss" = "waves";
  wave = 0;
  autoBoss = true;
  autoSkills = true;
  bossTimeLeft = 0;

  stats: FighterStats = IDLE_STATS;
  heroHp = IDLE_STATS.maxHp;
  heroDownLeft = 0;
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];

  private heroCooldown = 0;
  private spawnQueue: Array<{ spec: MonsterSpec; delay: number }> = [];
  private skillCooldown: Record<SkillId, number> = {
    meteor: 0,
    frenzy: 0,
    heal: 0,
  };
  private skillActive: Record<SkillId, number> = {
    meteor: 0,
    frenzy: 0,
    heal: 0,
  };
  private nextId = 1;
  private readonly random: () => number;
  private events: BattleEvent[] = [];

  constructor(opts: { stage?: number; best?: number; seed?: number } = {}) {
    this.random = seededRandom(opts.seed ?? Date.now());
    this.stage = Math.max(1, Math.floor(opts.stage ?? 1));
    this.best = Math.max(this.stage, Math.floor(opts.best ?? 1));
    this.startWave(0);
  }

  // ── Inputs ─────────────────────────────────────────────────────────────────────────────────

  /** New numbers of the hero (an upgrade, other gear, another hero): HP keeps its share. */
  setStats(stats: FighterStats): void {
    const share = this.stats.maxHp > 0 ? this.heroHp / this.stats.maxHp : 1;
    this.stats = stats;
    this.heroHp = Math.max(1, Math.min(stats.maxHp, share * stats.maxHp));
  }

  /** Jump to a stage (progress loaded from the server); the fight restarts there. */
  setStage(stage: number, best = this.best): void {
    this.stage = Math.max(1, Math.floor(stage));
    this.best = Math.max(this.stage, Math.floor(best));
    this.mode = "waves";
    this.monsters = [];
    this.projectiles = [];
    this.startWave(0);
  }

  /** The "Boss" button: fight the boss now and keep advancing after it. */
  challengeBoss(): boolean {
    if (this.mode === "boss" || this.heroDownLeft > 0) return false;
    this.autoBoss = true;
    this.startBoss();
    return true;
  }

  setAutoSkills(on: boolean): void {
    this.autoSkills = on;
  }

  /** Cast a skill now. `false` — locked, cooling down, or the hero is down. */
  castSkill(id: SkillId): boolean {
    const def = SKILLS.find((s) => s.id === id);
    if (!def || !this.skillUnlocked(def)) return false;
    if (this.skillCooldown[id] > 0 || this.heroDownLeft > 0) return false;
    this.skillCooldown[id] = def.cooldown;
    this.skillActive[id] = def.duration;
    this.emit({ type: "skill", skill: id });
    if (id === "meteor") {
      const damage = this.stats.damage * METEOR_POWER;
      for (const m of [...this.monsters])
        if (m.x < 1) this.damageMonster(m, damage, false);
    } else if (id === "heal") {
      this.heroHp = Math.min(
        this.stats.maxHp,
        this.heroHp + this.stats.maxHp * HEAL_SHARE,
      );
    }
    return true;
  }

  // ── The clock ──────────────────────────────────────────────────────────────────────────────

  /** Advance by `dt` seconds (clamped — a hidden tab must not resolve a minute in one step). */
  tick(dt: number): BattleEvent[] {
    this.events = [];
    let left = Math.min(Math.max(0, dt), 0.25);
    while (left > 0) {
      const step = Math.min(left, 1 / 30);
      this.step(step);
      left -= step;
    }
    return this.events;
  }

  private step(dt: number): void {
    for (const def of SKILLS) {
      this.skillCooldown[def.id] = Math.max(0, this.skillCooldown[def.id] - dt);
      this.skillActive[def.id] = Math.max(0, this.skillActive[def.id] - dt);
    }

    if (this.heroDownLeft > 0) {
      this.heroDownLeft -= dt;
      if (this.heroDownLeft <= 0) {
        this.heroDownLeft = 0;
        this.heroHp = this.stats.maxHp;
        this.emit({ type: "heroUp" });
        this.startWave(0);
      }
      return;
    }

    this.heroHp = Math.min(
      this.stats.maxHp,
      this.heroHp + this.stats.regen * dt,
    );
    if (this.autoSkills) this.autoCast();
    this.spawn(dt);
    this.heroAttack(dt);
    this.moveProjectiles(dt);
    this.monstersAct(dt);
    if (this.heroDownLeft > 0) return;

    if (this.mode === "boss") {
      this.bossTimeLeft -= dt;
      if (this.bossTimeLeft <= 0 && this.monsters.some((m) => m.spec.boss))
        return this.failBoss("time");
    }

    if (this.monsters.length === 0 && this.spawnQueue.length === 0) {
      if (this.mode === "boss") return; // cleared by the kill handler
      this.emit({ type: "waveCleared", wave: this.wave });
      const next = this.wave + 1;
      if (next < WAVES_PER_STAGE) this.startWave(next);
      else if (this.autoBoss) this.startBoss();
      else this.startWave(0);
    }
  }

  private autoCast(): void {
    for (const def of SKILLS) {
      if (!this.skillUnlocked(def) || this.skillCooldown[def.id] > 0) continue;
      if (def.id === "heal") {
        if (this.heroHp < this.stats.maxHp * AUTO_HEAL_BELOW)
          this.castSkill("heal");
      } else if (this.monsters.some((m) => m.x < RANGE_X)) {
        this.castSkill(def.id);
      }
    }
  }

  private spawn(dt: number): void {
    const first = this.spawnQueue[0];
    if (!first) return;
    first.delay -= dt;
    if (first.delay > 0) return;
    this.spawnQueue.shift();
    const m: Monster = {
      id: this.nextId++,
      spec: first.spec,
      hp: first.spec.hp,
      maxHp: first.spec.hp,
      x: SPAWN_X,
      cooldown: first.spec.attackInterval * 0.5,
    };
    this.monsters.push(m);
    this.emit({ type: "spawn", monster: m });
  }

  private heroAttack(dt: number): void {
    const speed =
      this.stats.attackSpeed * (this.skillActive.frenzy > 0 ? FRENZY_SPEED : 1);
    this.heroCooldown -= dt * speed;
    if (this.heroCooldown > 0) return;
    const targets = this.monsters
      .filter((m) => m.x < RANGE_X)
      .sort((a, b) => a.x - b.x);
    const target = targets[0];
    if (!target) {
      this.heroCooldown = 0; // ready the moment someone walks in
      return;
    }
    this.heroCooldown += 1;
    this.fire(target, false);
    if (this.stats.multiShot > 0 && this.random() < this.stats.multiShot)
      this.fire(targets[1] ?? target, true);
  }

  private fire(target: Monster, extra: boolean): void {
    const crit = this.random() < this.stats.critChance;
    const p: Projectile = {
      id: this.nextId++,
      x: HERO_X + 0.04,
      targetId: target.id,
      damage: this.stats.damage * (crit ? this.stats.critMultiplier : 1),
      crit,
      extra,
    };
    this.projectiles.push(p);
    this.emit({ type: "shoot", projectile: p });
  }

  private moveProjectiles(dt: number): void {
    for (const p of [...this.projectiles]) {
      let target = this.monsters.find((m) => m.id === p.targetId);
      if (!target) {
        // Its target died on the way: the shot flies on to the next monster, or fizzles.
        target = this.monsters
          .filter((m) => m.x > p.x)
          .sort((a, b) => a.x - b.x)[0];
        if (!target) {
          this.dropProjectile(p);
          continue;
        }
        p.targetId = target.id;
      }
      p.x += PROJECTILE_SPEED * dt;
      if (p.x < target.x) continue;
      this.dropProjectile(p);
      this.damageMonster(target, p.damage, p.crit);
    }
  }

  // A kill can clear the stage mid-loop and replace the list: a shot of the old list is just gone.
  private dropProjectile(p: Projectile): void {
    const i = this.projectiles.indexOf(p);
    if (i >= 0) this.projectiles.splice(i, 1);
  }

  private damageMonster(m: Monster, damage: number, crit: boolean): void {
    if (!this.monsters.includes(m)) return;
    m.hp -= damage;
    this.emit({ type: "hit", monsterId: m.id, x: m.x, damage, crit });
    if (m.hp > 0) return;
    this.monsters.splice(this.monsters.indexOf(m), 1);
    this.emit({ type: "kill", monsterId: m.id, x: m.x, boss: m.spec.boss });
    if (m.spec.boss) this.clearStage();
  }

  private monstersAct(dt: number): void {
    for (const m of this.monsters) {
      const stop = MELEE_X + (m.spec.boss ? 0.05 : 0);
      if (m.x > stop) {
        m.x = Math.max(stop, m.x - m.spec.speed * dt);
        continue;
      }
      m.cooldown -= dt;
      if (m.cooldown > 0) continue;
      m.cooldown += m.spec.attackInterval;
      if (this.random() < this.stats.dodge) {
        this.emit({ type: "dodge" });
        continue;
      }
      const damage = Math.max(MIN_HIT, m.spec.attack - this.stats.armor);
      this.heroHp -= damage;
      this.emit({ type: "heroHit", damage });
      if (this.heroHp <= 0) return this.heroDown();
    }
  }

  // ── Stage flow ─────────────────────────────────────────────────────────────────────────────

  private startWave(wave: number): void {
    this.mode = "waves";
    this.wave = wave;
    this.spawnQueue = waveMonsters(this.stage, wave).map((spec, i) => ({
      spec,
      delay: i === 0 ? 0.3 : SPAWN_GAP_SECONDS,
    }));
  }

  private startBoss(): void {
    this.mode = "boss";
    this.monsters = [];
    this.projectiles = [];
    this.bossTimeLeft = BOSS_SECONDS;
    this.spawnQueue = [{ spec: bossMonster(this.stage), delay: 0.4 }];
    this.emit({ type: "bossStart" });
  }

  private clearStage(): void {
    const cleared = this.stage;
    this.stage += 1;
    this.best = Math.max(this.best, this.stage);
    this.monsters = [];
    this.projectiles = [];
    this.emit({ type: "stageCleared", stage: cleared });
    this.startWave(0);
  }

  private failBoss(reason: "time" | "down"): void {
    this.autoBoss = false;
    this.monsters = [];
    this.projectiles = [];
    this.emit({ type: "bossFailed", reason });
    if (reason === "time") this.startWave(0);
  }

  private heroDown(): void {
    this.heroHp = 0;
    this.heroDownLeft = RESPAWN_SECONDS;
    this.emit({ type: "heroDown" });
    if (this.mode === "boss") this.failBoss("down");
    this.monsters = [];
    this.projectiles = [];
    this.spawnQueue = [];
    this.mode = "waves";
  }

  private skillUnlocked(def: SkillDef): boolean {
    return this.best >= def.unlockStage;
  }

  private emit(e: BattleEvent): void {
    this.events.push(e);
  }

  // ── Reading ────────────────────────────────────────────────────────────────────────────────

  snapshot(): BattleSnapshot {
    const boss = this.monsters.find((m) => m.spec.boss);
    return {
      stage: this.stage,
      best: this.best,
      mode: this.mode,
      wave: this.wave,
      waves: WAVES_PER_STAGE,
      bossTimeLeft: this.mode === "boss" ? Math.max(0, this.bossTimeLeft) : 0,
      bossHp: boss ? Math.max(0, boss.hp) : 0,
      bossMaxHp: boss?.maxHp ?? 0,
      heroHp: Math.max(0, this.heroHp),
      heroMaxHp: this.stats.maxHp,
      heroDown: this.heroDownLeft > 0,
      monsters: this.monsters.length,
      autoBoss: this.autoBoss,
      autoSkills: this.autoSkills,
      skills: SKILLS.map((def) => ({
        id: def.id,
        unlocked: this.skillUnlocked(def),
        unlockStage: def.unlockStage,
        cooldownLeft: this.skillCooldown[def.id],
        cooldown: def.cooldown,
        activeLeft: this.skillActive[def.id],
      })),
    };
  }
}
