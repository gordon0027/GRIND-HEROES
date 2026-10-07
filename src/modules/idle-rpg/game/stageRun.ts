// Grind Heroes' transient, deterministic stage simulation. Distances are metres;
// x positions are normalized screen-lane coordinates and never determine progress.

import { heroAttackTiming, enemyAttackTiming, scaledEventDelay } from "./combatTiming.ts";

export const MAX_PARTY_SIZE = 3;
export type SlotIndex = 1 | 2 | 3;
export type RunState = "ready" | "running" | "encounter" | "boss" | "clear" | "failed";
export type FighterState = "idle" | "running" | "chasing" | "attacking" | "dead";
export type CombatType = "MELEE" | "RANGED";
export type ProjectileType = "ARROW" | "MAGIC_ORB";
export interface ProjectileSpec { type: ProjectileType; speed: number; releaseDelay: number }

export interface HeroSource {
  id: string;
  classId: string;
  level: number;
  maxHp: number;
  attack: number;
  defence: number;
  attackSpeed: number;
  moveSpeed: number;
  attackRange: number;
  combatType: CombatType;
  projectile: ProjectileSpec | null;
}

export interface PartySlot {
  index: SlotIndex;
  unlocked: boolean;
  hero: HeroSource | null;
}

export interface EnemyDefinition {
  type: string;
  maxHp: number;
  attack: number;
  defence: number;
  attackSpeed: number;
  moveSpeed: number;
  attackRange: number;
  combatType?: CombatType;
  projectile?: ProjectileSpec | null;
  visual?: string;
}

export interface EncounterDefinition {
  id: string;
  distance: number;
  enemies: EnemyDefinition[];
}

export interface StageDefinition {
  id: string;
  chapter: number;
  stage: number;
  name: string;
  length: number;
  encounters: EncounterDefinition[];
  boss: EncounterDefinition;
  environment?: string;
  unlockRequirement?: string | null;
  recommendedPower?: number;
  minimumClearSeconds?: number;
  rewards?: {
    repeat: { gold: number; heroXP: number; chestItemID: string; bossChestItemID?: string | null };
    firstClear?: { itemID: string };
  };
}

export interface RuntimeHero extends HeroSource {
  slot: SlotIndex;
  initialized: true;
  active: boolean;
  hp: number;
  alive: boolean;
  targetId: number | null;
  state: FighterState;
  x: number;
  travelDistance: number;
  cooldown: number;
  pendingImpact: { targetId: number; damage: number; remaining: number } | null;
}

export interface RuntimeEnemy extends EnemyDefinition {
  id: number;
  hp: number;
  alive: boolean;
  targetId: string | null;
  state: FighterState;
  x: number;
  cooldown: number;
  boss: boolean;
  pendingImpact: { targetId: string; damage: number; remaining: number } | null;
}

export interface PendingProjectile {
  id: number;
  attackerId: string;
  targetId: number;
  type: ProjectileType;
  damageSnapshot: number;
  originX: number;
  targetX: number;
  elapsed: number;
  travelDuration: number;
}

export interface EnemyProjectile {
  id: number;
  attackerId: number;
  targetId: string;
  damageSnapshot: number;
  originX: number;
  targetX: number;
  elapsed: number;
  travelDuration: number;
}

export type RunEvent =
  | { type: "encounterStarted"; id: string; boss: boolean }
  | { type: "enemyDefeated"; id: number }
  | { type: "heroAttacked"; id: string; targetId: number }
  | { type: "enemyHit"; id: number; source: "MELEE" | ProjectileType }
  | { type: "enemyAttackStarted"; id: number; targetId: string }
  | { type: "enemyAttacked"; id: number; targetId: string }
  | { type: "heroDied"; id: string }
  | { type: "encounterCleared"; id: string }
  | { type: "stageCleared"; seconds: number }
  | { type: "stageFailed"; seconds: number };

const FORMATION_X = 0.24;
const MAX_PARTY_SPREAD_METRES = 12;
const METRES_TO_LANE = 0.006;
const TRAVEL_REFORM_METRES_PER_LANE = 700;
const MIN_DAMAGE = 1;
export const COMBAT_TUNING = {
  backlineGap: 0.14,
  rangedSlotSpacing: 0.04,
  aggroSwitchLead: 0.04,
  aggroInterceptLead: 0.015,
  aggroInterceptBuffer: 0.02,
} as const;

function moveTowards(current: number, target: number, maxStep: number): number {
  return current + Math.sign(target - current) * Math.min(Math.abs(target - current), maxStep);
}

/** Small, isolated V1 formula. Both sides use the same calculation. */
export function damage(attack: number, defence: number): number {
  return Math.max(MIN_DAMAGE, Math.round(attack - defence));
}

export const FIRST_STAGE: StageDefinition = {
  id: "grind-stage-1-1",
  chapter: 1,
  stage: 1,
  name: "1-1 · Meadow Road",
  length: 4500,
  environment: "forest",
  unlockRequirement: null,
  recommendedPower: 80,
  minimumClearSeconds: 7,
  rewards: { repeat: { gold: 30, heroXP: 25, chestItemID: "stage_chest" }, firstClear: { itemID: "traveler_boots" } },
  encounters: [
    { id: "meadow-1", distance: 675, enemies: [{ type: "Goblin Scout", maxHp: 15, attack: 1, defence: 0, attackSpeed: 0.8, moveSpeed: 0.40, attackRange: 0.10, visual: "goblin1" }] },
    { id: "meadow-2", distance: 1450, enemies: [
      { type: "Goblin Scout", maxHp: 18, attack: 1, defence: 0, attackSpeed: 0.8, moveSpeed: 0.40, attackRange: 0.10, visual: "goblin1" },
      { type: "Goblin Raider", maxHp: 20, attack: 2, defence: 1, attackSpeed: 0.9, moveSpeed: 0.47, attackRange: 0.10, visual: "goblin2" },
    ] },
    { id: "meadow-3", distance: 2275, enemies: [
      { type: "Goblin Raider", maxHp: 22, attack: 2, defence: 1, attackSpeed: 0.9, moveSpeed: 0.47, attackRange: 0.10, visual: "goblin2" },
      { type: "Goblin Brute", maxHp: 25, attack: 2, defence: 1, attackSpeed: 0.8, moveSpeed: 0.40, attackRange: 0.10, visual: "goblinboss" },
    ] },
    { id: "meadow-4", distance: 3075, enemies: [
      { type: "Goblin Brute", maxHp: 28, attack: 2, defence: 1, attackSpeed: 0.8, moveSpeed: 0.40, attackRange: 0.10, visual: "goblinboss" },
      { type: "Goblin Raider", maxHp: 25, attack: 2, defence: 1, attackSpeed: 0.9, moveSpeed: 0.47, attackRange: 0.10, visual: "goblin2" },
    ] },
    { id: "meadow-5", distance: 3875, enemies: [
      { type: "Goblin Scout", maxHp: 18, attack: 1, defence: 0, attackSpeed: 0.8, moveSpeed: 0.40, attackRange: 0.10, visual: "goblin1" },
      { type: "Goblin Raider", maxHp: 20, attack: 2, defence: 1, attackSpeed: 0.9, moveSpeed: 0.47, attackRange: 0.10, visual: "goblin2" },
    ] },
  ],
  boss: { id: "meadow-boss", distance: 4500, enemies: [
    { type: "Ogre Boss", maxHp: 85, attack: 3, defence: 1, attackSpeed: 0.8, moveSpeed: 0.28, attackRange: 0.12, visual: "ogreboss" },
  ] },
};

export class StageRun {
  readonly stage: StageDefinition;
  readonly slots: PartySlot[] = [
    { index: 1, unlocked: true, hero: null },
    { index: 2, unlocked: false, hero: null },
    { index: 3, unlocked: false, hero: null },
  ];
  heroes: RuntimeHero[] = [];
  /** One runtime record per hero for this run, including heroes on the bench. */
  readonly runHeroStates = new Map<string, RuntimeHero>();
  enemies: RuntimeEnemy[] = [];
  projectiles: PendingProjectile[] = [];
  enemyProjectiles: EnemyProjectile[] = [];
  state: RunState = "ready";
  distance = 0;
  elapsedSeconds = 0;
  completionSeconds: number | null = null;
  bestClearSeconds: number | null = null;
  encounterIndex = 0;
  activeEncounter: EncounterDefinition | null = null;
  private nextEnemyId = 1;
  private nextProjectileId = 1;

  constructor(stage: StageDefinition = FIRST_STAGE) {
    this.stage = stage;
    const points = [...stage.encounters, stage.boss];
    if (stage.length <= 0 || stage.boss.distance !== stage.length ||
        points.some((e, i) => e.enemies.length === 0 || e.distance <= (points[i - 1]?.distance ?? 0)))
      throw new Error("Stage encounters must be ordered and end with a boss at stage length");
  }

  /** Party membership is independent of character unlocks. A new source updates stats, not HP. */
  setSlots(slots: readonly PartySlot[]): void {
    if (slots.length !== MAX_PARTY_SIZE || slots.some((slot, i) => slot.index !== i + 1 || (!slot.unlocked && slot.hero)))
      throw new Error("Party must have three ordered slots; locked slots cannot hold heroes");
    const ids = slots.flatMap((slot) => slot.hero ? [slot.hero.id] : []);
    if (new Set(ids).size !== ids.length) throw new Error("A hero cannot occupy two slots");
    for (let i = 0; i < MAX_PARTY_SIZE; i++) this.slots[i] = { ...slots[i]! };
    if (this.state === "clear" || this.state === "failed") return;
    const active = this.heroes;
    const previouslyActive = new Set(active.map((hero) => hero.id));
    const activeIDs = new Set(ids);
    for (const hero of this.runHeroStates.values()) {
      hero.active = activeIDs.has(hero.id);
      if (!hero.active) hero.pendingImpact = null;
    }
    for (const enemy of this.enemies)
      if (enemy.targetId && !activeIDs.has(enemy.targetId)) {
        enemy.targetId = null;
        enemy.pendingImpact = null;
      }
    this.enemyProjectiles = this.enemyProjectiles.filter((shot) => activeIDs.has(shot.targetId));
    this.heroes = slots.flatMap((slot) => {
      if (!slot.unlocked || !slot.hero) return [];
      const source = slot.hero;
      const old = this.runHeroStates.get(source.id);
      const maxHp = Math.max(1, source.maxHp);
      if (old) {
        const oldInterval = 1 / Math.max(0.1, old.attackSpeed);
        const newInterval = 1 / Math.max(0.1, source.attackSpeed);
        old.cooldown = Math.max(0, old.cooldown * newInterval / oldInterval);
        Object.assign(old, source, { slot: slot.index, maxHp, active: true });
        old.hp = Math.min(old.hp, maxHp);
        if (!previouslyActive.has(source.id) && old.alive) {
          const rear = active.filter((hero) => hero.alive);
          if (rear.length) {
            old.x = Math.max(0.08, Math.min(...rear.map((member) => member.x)) - 0.06);
            old.travelDistance = Math.min(...rear.map((member) => member.travelDistance));
          }
        }
        return [old];
      }
      const rear = active.filter((hero) => hero.alive);
      const hero: RuntimeHero = {
        ...source, slot: slot.index, maxHp, hp: maxHp, alive: true,
        initialized: true, active: true, targetId: null, state: "idle",
        x: rear.length ? Math.max(0.08, Math.min(...rear.map((member) => member.x)) - 0.06) : FORMATION_X,
        travelDistance: rear.length ? Math.min(...rear.map((member) => member.travelDistance)) : this.distance,
        cooldown: 0, pendingImpact: null,
      };
      this.runHeroStates.set(source.id, hero);
      return [hero];
    });
  }

  start(): boolean {
    if (this.slots.every((slot) => !slot.unlocked || !slot.hero)) return false;
    this.state = "running";
    this.distance = 0;
    this.elapsedSeconds = 0;
    this.completionSeconds = null;
    this.encounterIndex = 0;
    this.activeEncounter = null;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.heroes = [];
    this.runHeroStates.clear();
    this.setSlots(this.slots);
    return true;
  }

  retry(): boolean { return this.start(); }

  tick(dt: number): RunEvent[] {
    const events: RunEvent[] = [];
    if (!Number.isFinite(dt) || dt <= 0) return events;
    let left = Math.min(dt, 0.25); // hidden tabs do not simulate missed minutes
    while (left > 0 && (this.state === "running" || this.state === "encounter" || this.state === "boss")) {
      const step = Math.min(left, 1 / 60);
      this.step(step, events);
      left -= step;
    }
    return events;
  }

  private step(dt: number, events: RunEvent[]): void {
    this.elapsedSeconds += dt;
    if (this.state === "running") {
      const living = this.heroes.filter((hero) => hero.alive);
      if (living.length === 0) return this.fail(events);
      const next = this.nextEncounter();
      const rear = Math.min(...living.map((hero) => hero.travelDistance));
      for (const hero of living) {
        hero.travelDistance = Math.min(next.distance, rear + MAX_PARTY_SPREAD_METRES,
          hero.travelDistance + Math.max(0, hero.moveSpeed) * dt);
        hero.state = "running";
      }
      const front = Math.max(...living.map((hero) => hero.travelDistance));
      // Progress and background follow the first arrival continuously. A straggler can
      // remain behind at the encounter without making the camera jump forward or back.
      this.distance = Math.max(this.distance, front);
      const partyRear = Math.min(...living.map((hero) => hero.travelDistance));
      for (const hero of living) {
        const formationX = FORMATION_X +
          Math.max(0, hero.travelDistance - partyRear) * METRES_TO_LANE;
        // x is the persistent lane position. The formation is only a travel target;
        // movement out of combat is bounded by this hero's own Move Speed.
        hero.x = moveTowards(hero.x, formationX,
          Math.max(0, hero.moveSpeed) / TRAVEL_REFORM_METRES_PER_LANE * dt);
      }
      if (front >= next.distance) this.beginEncounter(next, events);
      return;
    }
    this.advanceImpacts(dt, events);
    if (this.enemies.length === 0) return this.finishEncounter(events);
    for (const hero of this.heroes.filter((h) => h.alive)) this.actHero(hero, dt, events);
    this.advanceProjectiles(dt, events);
    this.advanceEnemyProjectiles(dt, events);
    if (this.enemies.length === 0) return this.finishEncounter(events);
    for (const enemy of [...this.enemies]) this.actEnemy(enemy, dt, events);
    if (this.heroes.every((hero) => !hero.alive)) this.fail(events);
  }

  private nextEncounter(): EncounterDefinition {
    return this.stage.encounters[this.encounterIndex] ?? this.stage.boss;
  }

  private beginEncounter(encounter: EncounterDefinition, events: RunEvent[]): void {
    this.activeEncounter = encounter;
    this.state = encounter === this.stage.boss ? "boss" : "encounter";
    this.enemies = encounter.enemies.map((def, i) => ({
      ...def, id: this.nextEnemyId++, hp: def.maxHp, alive: true,
      targetId: null, state: "idle", x: Math.min(0.90,
        0.68 + i * 0.06 + (def.combatType === "RANGED" ? 0.09 : 0)),
      cooldown: 0, boss: encounter === this.stage.boss, pendingImpact: null,
    }));
    for (const hero of this.heroes) {
      hero.targetId = null;
      hero.pendingImpact = null;
    }
    events.push({ type: "encounterStarted", id: encounter.id, boss: this.state === "boss" });
  }

  private actHero(hero: RuntimeHero, dt: number, events: RunEvent[]): void {
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    if (hero.pendingImpact) {
      hero.state = "attacking";
      return;
    }
    let target = this.enemies.find((enemy) => enemy.id === hero.targetId);
    if (!target) target = [...this.enemies].sort((a, b) => Math.abs(a.x - hero.x) - Math.abs(b.x - hero.x))[0];
    hero.targetId = target?.id ?? null;
    if (!target) return;
    const step = Math.max(0, hero.moveSpeed) / 250 * dt;
    const meleeFront = hero.combatType === "RANGED"
      ? this.heroes.filter((member) => member.alive && member.combatType === "MELEE")
        .reduce((front, member) => Math.max(front, member.x), -Infinity) : -Infinity;
    const backlineLimit = meleeFront - COMBAT_TUNING.backlineGap -
      Math.max(0, hero.slot - 2) * COMBAT_TUNING.rangedSlotSpacing;
    if (hero.combatType === "RANGED" && hero.x > backlineLimit && Number.isFinite(backlineLimit)) {
      hero.state = "chasing";
      hero.x = moveTowards(hero.x, backlineLimit, step);
      return;
    }
    if (Math.abs(target.x - hero.x) > hero.attackRange) {
      const desired = target.x - Math.sign(target.x - hero.x) * hero.attackRange;
      const approach = hero.combatType === "RANGED" && Number.isFinite(backlineLimit)
        ? Math.min(desired, backlineLimit) : desired;
      hero.state = Math.abs(approach - hero.x) > 0.001 ? "chasing" : "idle";
      hero.x = moveTowards(hero.x, approach, step);
      return;
    }
    hero.state = "attacking";
    if (hero.cooldown > 0) return;
    hero.cooldown = 1 / Math.max(0.1, hero.attackSpeed);
    events.push({ type: "heroAttacked", id: hero.id, targetId: target.id });
    const strike = damage(hero.attack, target.defence);
    if (hero.combatType === "RANGED" && hero.projectile) {
      this.projectiles.push({
        id: this.nextProjectileId++, attackerId: hero.id, targetId: target.id,
        type: hero.projectile.type, damageSnapshot: strike,
        originX: hero.x, targetX: target.x,
        elapsed: -Math.max(0, scaledEventDelay(heroAttackTiming(hero.id),
          hero.attackSpeed, hero.projectile.releaseDelay)),
        travelDuration: Math.max(0.05, Math.abs(target.x - hero.x) / Math.max(0.01, hero.projectile.speed)),
      });
      return;
    }
    hero.pendingImpact = { targetId: target.id, damage: strike,
      remaining: scaledEventDelay(heroAttackTiming(hero.id), hero.attackSpeed) };
  }

  private advanceImpacts(dt: number, events: RunEvent[]): void {
    for (const hero of this.heroes) {
      const impact = hero.pendingImpact;
      if (!impact || !hero.alive) continue;
      impact.remaining -= dt;
      if (impact.remaining > 0) continue;
      hero.pendingImpact = null;
      const target = this.enemies.find((enemy) => enemy.id === impact.targetId && enemy.alive);
      if (!target || Math.abs(target.x - hero.x) > hero.attackRange + 0.015) continue;
      this.hitEnemy(target, impact.damage, "MELEE", events);
    }
    for (const enemy of [...this.enemies]) {
      const impact = enemy.pendingImpact;
      if (!impact || !enemy.alive) continue;
      impact.remaining -= dt;
      if (impact.remaining > 0) continue;
      enemy.pendingImpact = null;
      const target = this.heroes.find((hero) => hero.id === impact.targetId && hero.alive);
      if (!target || enemy.targetId !== target.id ||
          Math.abs(target.x - enemy.x) > enemy.attackRange + 0.015) continue;
      const frontmost = this.frontmostHero();
      if (frontmost && frontmost.id !== target.id &&
          this.shouldSwitchToFront(enemy, target, frontmost)) {
        enemy.targetId = frontmost.id;
        continue;
      }
      this.hitHero(target, impact.damage, enemy.id, events);
    }
  }

  private hitEnemy(target: RuntimeEnemy, amount: number,
    source: "MELEE" | ProjectileType, events: RunEvent[]): void {
    target.hp = Math.max(0, target.hp - amount);
    events.push({ type: "enemyHit", id: target.id, source });
    if (target.hp === 0) this.defeatEnemy(target, events);
  }

  private advanceProjectiles(dt: number, events: RunEvent[]): void {
    const remaining: PendingProjectile[] = [];
    for (const shot of this.projectiles) {
      const target = this.enemies.find((enemy) => enemy.id === shot.targetId && enemy.alive);
      if (!target) continue; // A shot never retargets a later enemy.
      shot.elapsed += dt;
      if (shot.elapsed < shot.travelDuration) { remaining.push(shot); continue; }
      this.hitEnemy(target, shot.damageSnapshot, shot.type, events);
    }
    this.projectiles = remaining.filter((shot) => this.enemies.some((enemy) => enemy.id === shot.targetId));
  }

  private advanceEnemyProjectiles(dt: number, events: RunEvent[]): void {
    const remaining: EnemyProjectile[] = [];
    for (const shot of this.enemyProjectiles) {
      const target = this.heroes.find((hero) => hero.id === shot.targetId && hero.alive);
      if (!target) continue;
      shot.elapsed += dt;
      if (shot.elapsed < shot.travelDuration) { remaining.push(shot); continue; }
      const front = this.frontmostHero();
      // A newly arrived frontline catches a shot aimed at a hero behind it.
      const recipient = front && front.x > target.x + COMBAT_TUNING.aggroInterceptLead ? front : target;
      this.hitHero(recipient, shot.damageSnapshot, shot.attackerId, events);
    }
    this.enemyProjectiles = remaining.filter((shot) =>
      this.heroes.some((hero) => hero.id === shot.targetId && hero.alive));
  }

  private hitHero(target: RuntimeHero, amount: number, attackerId: number, events: RunEvent[]): void {
    target.hp = Math.max(0, target.hp - amount);
    events.push({ type: "enemyAttacked", id: attackerId, targetId: target.id });
    if (target.hp > 0) return;
    target.alive = false;
    target.state = "dead";
    target.targetId = null;
    target.pendingImpact = null;
    events.push({ type: "heroDied", id: target.id });
  }

  private defeatEnemy(target: RuntimeEnemy, events: RunEvent[]): void {
    target.alive = false;
    target.state = "dead";
    target.targetId = null;
    target.pendingImpact = null;
    this.enemies.splice(this.enemies.indexOf(target), 1);
    events.push({ type: "enemyDefeated", id: target.id });
  }

  private actEnemy(enemy: RuntimeEnemy, dt: number, events: RunEvent[]): void {
    if (!enemy.alive) return;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    const living = this.heroes.filter((hero) => hero.alive);
    const frontmost = this.frontmostHero();
    let target = enemy.combatType === "RANGED" ? frontmost : living.find((hero) => hero.id === enemy.targetId);
    if (enemy.combatType !== "RANGED" && frontmost && target && frontmost.id !== target.id &&
        this.shouldSwitchToFront(enemy, target, frontmost)) target = frontmost;
    if (!target) target = frontmost ?? undefined;
    enemy.targetId = target?.id ?? null;
    if (!target) return;
    if (enemy.pendingImpact) {
      if (enemy.pendingImpact.targetId === target.id) {
        enemy.state = "attacking";
        return;
      }
      enemy.pendingImpact = null;
    }
    const meleeFront = enemy.combatType === "RANGED"
      ? this.enemies.filter((member) => member.id !== enemy.id && member.alive && member.combatType !== "RANGED")
        .reduce((front, member) => Math.min(front, member.x), Infinity) : Infinity;
    const backlineLimit = meleeFront + 0.12;
    if (Number.isFinite(backlineLimit) && enemy.x < backlineLimit) {
      enemy.state = "chasing";
      enemy.x = moveTowards(enemy.x, backlineLimit, enemy.moveSpeed * dt);
      return;
    }
    if (Math.abs(target.x - enemy.x) > enemy.attackRange + 0.001) {
      enemy.state = "chasing";
      const desired = target.x + Math.sign(enemy.x - target.x) * enemy.attackRange;
      enemy.x = moveTowards(enemy.x, Number.isFinite(backlineLimit)
        ? Math.max(desired, backlineLimit) : desired, enemy.moveSpeed * dt);
      return;
    }
    enemy.state = "attacking";
    if (enemy.cooldown > 0) return;
    enemy.cooldown = 1 / Math.max(0.1, enemy.attackSpeed);
    if (enemy.combatType === "RANGED" && enemy.projectile) {
      this.enemyProjectiles.push({
        id: this.nextProjectileId++, attackerId: enemy.id, targetId: target.id,
        damageSnapshot: damage(enemy.attack, target.defence),
        originX: enemy.x, targetX: target.x,
        elapsed: -Math.max(0, scaledEventDelay(enemyAttackTiming(false),
          enemy.attackSpeed, enemy.projectile.releaseDelay)),
        travelDuration: Math.max(0.05, Math.abs(target.x - enemy.x) /
          Math.max(0.01, enemy.projectile.speed)),
      });
      events.push({ type: "enemyAttackStarted", id: enemy.id, targetId: target.id });
      return;
    }
    enemy.pendingImpact = { targetId: target.id, damage: damage(enemy.attack, target.defence),
      remaining: scaledEventDelay(enemyAttackTiming(enemy.boss), enemy.attackSpeed) };
    events.push({ type: "enemyAttackStarted", id: enemy.id, targetId: target.id });
  }

  private frontmostHero(): RuntimeHero | null {
    return this.heroes.reduce<RuntimeHero | null>((front, hero) =>
      hero.alive && (!front || hero.x > front.x) ? hero : front, null);
  }

  private shouldSwitchToFront(enemy: RuntimeEnemy, target: RuntimeHero,
    frontmost: RuntimeHero): boolean {
    const lead = frontmost.x - target.x;
    return lead >= COMBAT_TUNING.aggroSwitchLead ||
      lead >= COMBAT_TUNING.aggroInterceptLead &&
      enemy.x <= frontmost.x + enemy.attackRange + COMBAT_TUNING.aggroInterceptBuffer;
  }

  private finishEncounter(events: RunEvent[]): void {
    if (!this.activeEncounter) return;
    this.projectiles = [];
    this.enemyProjectiles = [];
    for (const hero of this.heroes) hero.pendingImpact = null;
    events.push({ type: "encounterCleared", id: this.activeEncounter.id });
    if (this.state === "boss") {
      this.state = "clear";
      this.completionSeconds = this.elapsedSeconds;
      this.bestClearSeconds = this.bestClearSeconds === null
        ? this.elapsedSeconds : Math.min(this.bestClearSeconds, this.elapsedSeconds);
      events.push({ type: "stageCleared", seconds: this.elapsedSeconds });
    } else {
      this.encounterIndex++;
      this.state = "running";
      for (const hero of this.heroes) {
        hero.targetId = null;
        if (hero.alive) hero.state = "running";
      }
    }
    this.activeEncounter = null;
  }

  private fail(events: RunEvent[]): void {
    this.state = "failed";
    this.projectiles = [];
    this.enemyProjectiles = [];
    for (const hero of this.heroes) hero.pendingImpact = null;
    events.push({ type: "stageFailed", seconds: this.elapsedSeconds });
  }

  snapshot() {
    return {
      stageId: this.stage.id, stageName: this.stage.name, length: this.stage.length,
      state: this.state, distance: this.distance, elapsedSeconds: this.elapsedSeconds,
      completionSeconds: this.completionSeconds, bestClearSeconds: this.bestClearSeconds,
      encounterId: this.activeEncounter?.id ?? null,
      slots: this.slots.map((slot) => ({ index: slot.index, unlocked: slot.unlocked, heroId: slot.hero?.id ?? null })),
      heroes: this.heroes.map((hero) => ({ ...hero })),
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      projectiles: this.projectiles.map((projectile) => ({ ...projectile })),
      enemyProjectiles: this.enemyProjectiles.map((projectile) => ({ ...projectile })),
    };
  }
}
