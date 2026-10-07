/** Stage-earned hero level. Character.Level remains the iDos paid rank for combat. */
export const HERO_XP_KEY = "grind_hero_xp_v1";
export const HERO_LEVEL_CAP = 30;

export interface HeroProgress { level: number; xp: number }
export type HeroProgressMap = Record<string, HeroProgress>;

export function xpToNext(level: number): number {
  return level >= HERO_LEVEL_CAP ? 0 : 50 + 30 * (Math.max(1, level) - 1);
}

export function stageHeroXP(chapter: number, stage: number): number {
  return 25 + 5 * ((chapter - 1) * 10 + stage - 1);
}

export function heroProgress(value: unknown): HeroProgress {
  if (!value || typeof value !== "object") return { level: 1, xp: 0 };
  const record = value as Partial<HeroProgress>;
  const level = Number.isSafeInteger(record.level) ? Math.max(1, Math.min(HERO_LEVEL_CAP, record.level!)) : 1;
  const xp = Number.isSafeInteger(record.xp) ? Math.max(0, record.xp!) : 0;
  return { level, xp: level >= HERO_LEVEL_CAP ? 0 : Math.min(xp, xpToNext(level) - 1) };
}

export function parseHeroProgress(raw: string | null | undefined): HeroProgressMap {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([id, value]) => [id, heroProgress(value)]));
  } catch { return {}; }
}
