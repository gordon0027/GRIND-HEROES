/** All active-skill balance and visual tuning lives here. Times are simulation seconds. */
export const COMBAT_SKILLS = {
  Knight: {
    id: "crushing-blow", classId: "Knight", cooldown: 8,
    damageMultiplier: 2.5, buffDuration: 0, aoeRadius: 0,
    vfx: { color: 0xffd367, anticipationMs: 160, impactRadius: 42 },
  },
  Archer: {
    id: "rapid-fire", classId: "Archer", cooldown: 14,
    damageMultiplier: 1, buffDuration: 3, attackSpeedMultiplier: 3, aoeRadius: 0,
    projectileSpeedMultiplier: 1.5,
    vfx: { color: 0x8df269, anticipationMs: 120, impactRadius: 28 },
  },
  Mage: {
    id: "meteor-fireball", classId: "Mage", cooldown: 12,
    damageMultiplier: 1.8, buffDuration: 0, aoeRadius: 0.19,
    projectileSpeedMultiplier: 0.8,
    vfx: { color: 0xff713a, anticipationMs: 180, impactRadius: 58 },
  },
} as const;

export type SkillClass = keyof typeof COMBAT_SKILLS;
export type SkillId = typeof COMBAT_SKILLS[SkillClass]["id"];

export function skillFor(classId: string) {
  return COMBAT_SKILLS[classId as SkillClass] as typeof COMBAT_SKILLS[SkillClass] | undefined;
}

/** Combat uses playable hero IDs; Title roster ClassID is Warrior/Ranger/Mage. */
export function combatClassForHero(heroId: string, rosterClassId: string): string {
  return skillFor(heroId)?.classId ?? rosterClassId;
}

export function skillById(id: SkillId) {
  return Object.values(COMBAT_SKILLS).find((skill) => skill.id === id)!;
}

export function effectiveAttackSpeed(base: number, classId: string, buffRemaining: number): number {
  return Math.max(0.1, base * (classId === "Archer" && buffRemaining > 0
    ? COMBAT_SKILLS.Archer.attackSpeedMultiplier : 1));
}
