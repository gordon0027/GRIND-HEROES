/** Character.Level is server-owned; Stage Mastery never unlocks combat skills. */
export const HERO_SKILLS = {
  activeLevel: 5, passiveLevel: 8, masteryLevel: 10,
  Knight: { name: "Guardian's Resolve", threshold: 0.3, shieldFraction: 0.15, duration: 4 },
  Archer: { name: "Piercing Precision", everyAttacks: 5, damageMultiplier: 1.4 },
  Mage: { name: "Scorching Impact", ticks: 3, interval: 1, attackFraction: 0.12 },
  mastery: { Knight: 2.75, Archer: 3.5, Mage: 2.0 },
} as const;

export function activeSkillUnlocked(level: number): boolean {
  return Number.isFinite(level) && level >= HERO_SKILLS.activeLevel;
}

export function nextSkillMilestone(level: number) {
  return [
    { level: HERO_SKILLS.activeLevel, label: "Signature skill" },
    { level: HERO_SKILLS.passiveLevel, label: "Passive skill" },
    { level: HERO_SKILLS.masteryLevel, label: "Signature mastery" },
  ].find(milestone => level < milestone.level) ?? null;
}
