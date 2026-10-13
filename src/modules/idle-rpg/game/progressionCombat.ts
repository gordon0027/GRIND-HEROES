import { HERO_SKILLS } from "./progressionSkills.ts";
import type { RuntimeEnemy, RuntimeHero } from "./stageRun.ts";

export function advanceBurns(enemies: readonly RuntimeEnemy[], dt: number,
  hit: (enemy: RuntimeEnemy, amount: number, attackerId: string) => void): void {
  for (const enemy of [...enemies]) {
    const burn = enemy.burn;
    if (!burn) continue;
    burn.remaining -= dt;
    if (burn.remaining > 0) continue;
    hit(enemy, burn.damage, burn.attackerId);
    if (--burn.ticks <= 0) enemy.burn = undefined;
    else burn.remaining += HERO_SKILLS.Mage.interval;
  }
}

export function shieldedDamage(hero: RuntimeHero, amount: number): number {
  if (hero.progressionSkills && hero.classId === "Knight" && hero.level >= HERO_SKILLS.passiveLevel &&
      !hero.shieldUsed && hero.hp / hero.maxHp <= HERO_SKILLS.Knight.threshold) {
    hero.shieldUsed = true;
    hero.shieldHp = Math.round(hero.maxHp * HERO_SKILLS.Knight.shieldFraction);
    hero.shieldRemaining = HERO_SKILLS.Knight.duration;
  }
  const absorbed = Math.min(amount, hero.shieldHp);
  hero.shieldHp -= absorbed;
  return amount - absorbed;
}
