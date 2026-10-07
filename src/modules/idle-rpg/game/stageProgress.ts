import { STAGE_CATALOG } from "./stageCatalog.ts";

export const STAGE_PROGRESS_KEY = "grind_stage_progress_v2";

export interface StageProgress {
  highestUnlocked: number;
  completed: Record<string, number>;
  bestSeconds: Record<string, number>;
}

export const INITIAL_STAGE_PROGRESS: StageProgress = {
  highestUnlocked: 1, completed: {}, bestSeconds: {},
};

export function parseStageProgress(raw: string | null | undefined): StageProgress {
  if (!raw) return { ...INITIAL_STAGE_PROGRESS, completed: {}, bestSeconds: {} };
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return parseStageProgress(null);
    const candidate = data as Partial<StageProgress>;
    const highest = Number(candidate.highestUnlocked);
    const completed: Record<string, number> = {};
    const bestSeconds: Record<string, number> = {};
    // V2 had five flat IDs. Preserve a player's unlocked stages and records.
    const legacy = (id: string) => {
      const match = /^grind-stage-1-([1-5])$/.exec(id);
      return match ? `grind-stage-${match[1]}` : id;
    };
    for (const stage of STAGE_CATALOG) {
      const count = Number(candidate.completed?.[stage.id] ?? candidate.completed?.[legacy(stage.id)]);
      if (Number.isInteger(count) && count > 0) completed[stage.id] = count;
      // Old times belong to ~5× shorter stages. Keep them under legacy keys on
      // the server, but do not compare them with the new chapter-stage runs.
      const best = Number(candidate.bestSeconds?.[stage.id]);
      if (Number.isFinite(best) && best > 0) bestSeconds[stage.id] = best;
    }
    return {
      highestUnlocked: Math.max(1, Math.min(STAGE_CATALOG.length,
        Number.isInteger(highest) ? highest : 1)),
      completed, bestSeconds,
    };
  } catch { return parseStageProgress(null); }
}

export function stageUnlocked(progress: StageProgress, stageID: string): boolean {
  const index = STAGE_CATALOG.findIndex((stage) => stage.id === stageID);
  return index >= 0 && index < progress.highestUnlocked;
}

export function recordStageClear(progress: StageProgress, stageID: string, seconds: number): StageProgress {
  const index = STAGE_CATALOG.findIndex((stage) => stage.id === stageID);
  if (index < 0 || !stageUnlocked(progress, stageID) || !Number.isFinite(seconds) || seconds <= 0)
    return progress;
  const prior = progress.bestSeconds[stageID];
  return {
    highestUnlocked: Math.max(progress.highestUnlocked, Math.min(STAGE_CATALOG.length, index + 2)),
    completed: { ...progress.completed, [stageID]: (progress.completed[stageID] ?? 0) + 1 },
    bestSeconds: { ...progress.bestSeconds, [stageID]: prior === undefined ? seconds : Math.min(prior, seconds) },
  };
}
