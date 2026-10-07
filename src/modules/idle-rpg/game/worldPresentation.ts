import type { RunState, StageRun } from "./stageRun";

// Presentation metres are independent of viewport width and of StageRun's
// normalized combat lane. Combat keeps its existing timings and attack ranges.
const COMBAT_METRES_PER_LANE = 250;
const FORMATION_SPACING_METRES = 30;
const ENEMY_LEAD_METRES = (0.68 - 0.24) * COMBAT_METRES_PER_LANE;
const MOBILE_CAMERA_DEAD_ZONE_METRES = 22;
const DESKTOP_MIN_WIDTH = 1024;
// A fixed pixel zone: wider screens reveal more world, not more party travel.
export const DESKTOP_CAMERA_RIGHT_PX = 80;
// The bound only prevents jumps; it must exceed boosted hero travel speed.
export const CAMERA_MAX_METRES_PER_SECOND = 240;
export const PIXELS_PER_WORLD_METRE = 1.3;

interface HeroPosition {
  worldX: number;
  combatX: number;
  travelDistance: number;
}

interface EnemyPosition {
  worldX: number;
  combatX: number;
}

export interface PresentedEnemy {
  id: number;
  worldX: number;
  hp: number;
  maxHp: number;
  boss: boolean;
  visual: string;
  state: "idle" | "running" | "chasing" | "attacking" | "dead";
}

interface UpcomingEncounter {
  id: string;
  enemies: PresentedEnemy[];
}

/** Persistent world positions and one camera; neither is rebuilt at encounter boundaries. */
export class WorldPresentation {
  private heroes = new Map<string, HeroPosition>();
  private activeLastFrame = new Set<string>();
  private enemies = new Map<number, EnemyPosition>();
  private upcoming: UpcomingEncounter | null = null;
  private previousState: RunState = "ready";
  private cameraStarted = false;
  cameraWorldX = 0;

  reset(): void {
    this.heroes.clear();
    this.activeLastFrame.clear();
    this.enemies.clear();
    this.upcoming = null;
    this.previousState = "ready";
    this.cameraStarted = false;
    this.cameraWorldX = 0;
  }

  update(run: StageRun, dt: number, viewportWidth = 390): void {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;
    const wasFighting = this.previousState === "encounter" || this.previousState === "boss";
    const activeIDs = new Set(run.heroes.map((hero) => hero.id));
    // Benched heroes keep their last world position for this run. Only deployed
    // heroes influence spawn placement and camera movement.
    const existingWorld = [...this.heroes].filter(([id]) => activeIDs.has(id) && this.activeLastFrame.has(id))
      .map(([, position]) => position.worldX);
    const frontBefore = existingWorld.length ? Math.max(...existingWorld) : run.distance;
    for (const hero of run.heroes) {
      let position = this.heroes.get(hero.id);
      if (!position) {
        position = {
          worldX: frontBefore - (hero.slot - 1) * FORMATION_SPACING_METRES,
          combatX: hero.x,
          travelDistance: hero.travelDistance,
        };
        this.heroes.set(hero.id, position);
      } else if (!this.activeLastFrame.has(hero.id) && hero.alive) {
        // A living bench return is a new entrance near today's party, while its
        // HP and cooldown stay in StageRun's original per-run record.
        position.worldX = frontBefore - (hero.slot - 1) * FORMATION_SPACING_METRES;
      } else if (wasFighting) {
        // The last combat frame is still combat even if it clears the encounter.
        // Mirror signed combat movement so a ranged hero visibly retreats
        // behind the frontline. Camera movement is independently forward-only.
        position.worldX += (hero.x - position.combatX) * COMBAT_METRES_PER_LANE;
      } else if (run.state === "running" || run.state === "encounter" || run.state === "boss") {
        const advance = Math.max(0, hero.travelDistance - position.travelDistance);
        const desiredBehind = (hero.slot - 1) * FORMATION_SPACING_METRES;
        const formationGap = frontBefore - position.worldX - desiredBehind;
        const catchUp = Math.min(0.45, Math.max(0, formationGap) / 90);
        const easeAhead = Math.min(0.35, Math.max(0, -formationGap) / 90);
        position.worldX += advance * (1 + catchUp - easeAhead);
      }
      position.combatX = hero.x;
      position.travelDistance = hero.travelDistance;
    }
    this.activeLastFrame = activeIDs;

    const fighting = run.state === "encounter" || run.state === "boss";
    if (fighting) {
      for (const [index, enemy] of run.enemies.entries()) {
        let position = this.enemies.get(enemy.id);
        if (!position) {
          position = {
            worldX: this.upcoming?.enemies[index]?.worldX ??
              frontBefore + ENEMY_LEAD_METRES + index * 0.09 * COMBAT_METRES_PER_LANE,
            combatX: enemy.x,
          };
          this.enemies.set(enemy.id, position);
        } else {
          position.worldX += (enemy.x - position.combatX) * COMBAT_METRES_PER_LANE;
          position.combatX = enemy.x;
        }
      }
      const ids = new Set(run.enemies.map((enemy) => enemy.id));
      for (const id of this.enemies.keys()) if (!ids.has(id)) this.enemies.delete(id);
      this.upcoming = null;
    } else {
      this.enemies.clear();
      if (run.state === "running" || run.state === "ready") {
        const next = run.stage.encounters[run.encounterIndex] ?? run.stage.boss;
        if (this.upcoming?.id !== next.id) {
          const front = Math.max(...run.heroes.filter((hero) => hero.alive)
            .map((hero) => this.heroes.get(hero.id)?.worldX ?? 0), 0);
          const first = front + Math.max(0, next.distance - run.distance) + ENEMY_LEAD_METRES;
          this.upcoming = {
            id: next.id,
            enemies: next.enemies.map((enemy, index) => ({
              id: -(index + 1), worldX: first + index * 0.09 * COMBAT_METRES_PER_LANE,
              hp: enemy.maxHp, maxHp: enemy.maxHp, boss: next === run.stage.boss,
              visual: enemy.visual ?? "goblin1", state: "idle",
            })),
          };
        }
      } else this.upcoming = null;
    }

    const desktop = viewportWidth >= DESKTOP_MIN_WIDTH;
    const living = run.heroes.filter((hero) => hero.alive);
    // Desktop tracks Slot 1 while it lives, so ranged spacing cannot move the
    // reference. Narrow screens retain their previous front-most reference.
    const referenceWorldX = desktop
      ? this.heroes.get(living[0]?.id ?? "")?.worldX
      : living.length ? Math.max(...living.map((hero) => this.heroes.get(hero.id)?.worldX ?? 0))
        : undefined;
    if (referenceWorldX !== undefined) {
      if (!this.cameraStarted) {
        this.cameraWorldX = referenceWorldX;
        this.cameraStarted = true;
      } else if (desktop) {
        // The right edge is a limit, not a target to spring back to after combat.
        const overrun = referenceWorldX - this.cameraWorldX -
          DESKTOP_CAMERA_RIGHT_PX / PIXELS_PER_WORLD_METRE;
        this.cameraWorldX += Math.min(Math.max(0, overrun),
          CAMERA_MAX_METRES_PER_SECOND * step);
      } else {
        // Preserve the existing narrow-screen smoothing, but never scroll the
        // world backwards during normal forward progression.
        const gap = referenceWorldX - this.cameraWorldX;
        const target = gap <= MOBILE_CAMERA_DEAD_ZONE_METRES
          ? this.cameraWorldX
          : referenceWorldX - MOBILE_CAMERA_DEAD_ZONE_METRES;
        const smoothStep = (target - this.cameraWorldX) * (1 - Math.exp(-step / 0.35));
        this.cameraWorldX += Math.min(Math.max(0, smoothStep),
          CAMERA_MAX_METRES_PER_SECOND * step);
      }
    }
    this.previousState = run.state;
  }

  heroWorldX(id: string): number {
    return this.heroes.get(id)?.worldX ?? 0;
  }

  enemyWorldX(id: number): number {
    return this.enemies.get(id)?.worldX ?? 0;
  }

  visibleEnemies(run: StageRun): PresentedEnemy[] {
    if (run.state === "encounter" || run.state === "boss")
      return run.enemies.map((enemy) => ({
        id: enemy.id, worldX: this.enemyWorldX(enemy.id), hp: enemy.hp,
        maxHp: enemy.maxHp, boss: enemy.boss,
        visual: enemy.visual ?? "goblin1", state: enemy.state,
      }));
    return run.state === "ready" || run.state === "running"
      ? this.upcoming?.enemies ?? [] : [];
  }
}

export function projectWorldX(worldX: number, cameraWorldX: number, viewportWidth: number): number {
  return viewportWidth * 0.36 + (worldX - cameraWorldX) * PIXELS_PER_WORLD_METRE;
}
