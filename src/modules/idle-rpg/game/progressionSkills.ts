/** V1 progression tuning. Character.Level is server-owned; stage XP never unlocks these. */
export const HERO_SKILLS = {
  passiveLevel: 5, masteryLevel: 10,
  Knight: { name: "Guardian's Resolve", threshold: 0.3, shieldFraction: 0.15, duration: 4 },
  Archer: { name: "Piercing Precision", everyAttacks: 5, damageMultiplier: 1.4 },
  Mage: { name: "Scorching Impact", ticks: 3, interval: 1, attackFraction: 0.12 },
  mastery: { Knight: 2.75, Archer: 3.5, Mage: 2.0 },
} as const;
