/** Stable slots survive deaths; targeting remains in the existing normalized lane. */
export function enemySpawnX(index: number, ranged: boolean): number {
  return 0.68 + index * 0.065 + (ranged ? 0.16 : 0);
}

export function enemyGroundSlot(index: number): { x: number; y: number } {
  return { x: Math.floor(index / 2) * 24, y: index % 2 === 0 ? -12 : 14 };
}

export function enemyDensity(chapter: number, stage: number): readonly [number, number] {
  return chapter === 1 ? stage <= 3 ? [1, 2] : stage <= 6 ? [2, 3] : [3, 4]
    : chapter === 2 ? stage <= 5 ? [3, 5] : [4, 5]
      : stage <= 5 ? [4, 6] : [5, 6];
}
