import type { CombatType, ProjectileSpec } from "./stageRun";
import { ATTACK_TIMING, baseEventDelay } from "./combatTiming.ts";

interface HeroArchetype {
  moveSpeed: number;
  attackRange: number;
  cadence: number;
  hit: number;
  color: number;
  combatType: CombatType;
  projectile: ProjectileSpec | null;
}

/** Stage-only class tuning. Lane distances match StageRun's normalized combat coordinates. */
export const HERO_ARCHETYPES: Record<string, HeroArchetype> = {
  Knight: { moveSpeed: 140, attackRange: 0.13, cadence: 1, hit: 1, color: 0x3a62c4,
    combatType: "MELEE", projectile: null },
  Archer: { moveSpeed: 162, attackRange: 0.58, cadence: 1.2, hit: 0.9, color: 0x3b9464,
    combatType: "RANGED", projectile: { type: "ARROW", speed: 1.5,
      releaseDelay: baseEventDelay(ATTACK_TIMING.hero.Archer) } },
  Mage: { moveSpeed: 130, attackRange: 0.47, cadence: 0.8, hit: 1.35, color: 0x8b5aba,
    combatType: "RANGED", projectile: { type: "MAGIC_ORB", speed: 1.1,
      releaseDelay: baseEventDelay(ATTACK_TIMING.hero.Mage) } },
};

export function heroArchetype(id: string) {
  return HERO_ARCHETYPES[id] ?? HERO_ARCHETYPES.Knight!;
}
