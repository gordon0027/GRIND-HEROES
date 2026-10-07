// Source sheets use twelve attack frames (24-35). These timings belong to the
// simulation; Phaser only plays the matching animation.
export const ATTACK_TIMING = {
  hero: {
    Knight: { fps: 18, eventFrame: 32 }, // sword reaches the enemy
    Archer: { fps: 18, eventFrame: 29 }, // bow releases
    Mage: { fps: 18, eventFrame: 31 }, // hand casts
  },
  enemy: {
    normal: { fps: 16, eventFrame: 30 },
    boss: { fps: 16, eventFrame: 34 },
  },
} as const;

const FIRST_ATTACK_FRAME = 24;
const ATTACK_FRAME_COUNT = 12;

export function baseEventDelay(timing: { fps: number; eventFrame: number }): number {
  return (timing.eventFrame - FIRST_ATTACK_FRAME) / timing.fps;
}

export function attackDuration(fps: number, attackSpeed: number): number {
  const natural = ATTACK_FRAME_COUNT / fps;
  return Math.min(natural, 1 / Math.max(0.1, attackSpeed));
}

export function attackPlaybackScale(fps: number, attackSpeed: number): number {
  return ATTACK_FRAME_COUNT / fps / attackDuration(fps, attackSpeed);
}

export function scaledEventDelay(
  timing: { fps: number; eventFrame: number }, attackSpeed: number,
  baseDelay = baseEventDelay(timing),
): number {
  return baseDelay * attackDuration(timing.fps, attackSpeed) /
    (ATTACK_FRAME_COUNT / timing.fps);
}

export function heroAttackTiming(id: string) {
  return ATTACK_TIMING.hero[id as keyof typeof ATTACK_TIMING.hero] ?? ATTACK_TIMING.hero.Knight;
}

export function enemyAttackTiming(boss: boolean) {
  return boss ? ATTACK_TIMING.enemy.boss : ATTACK_TIMING.enemy.normal;
}
