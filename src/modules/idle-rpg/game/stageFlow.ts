import { STAGE_CATALOG } from "./stageCatalog.ts";
import { stageUnlocked, type StageProgress } from "./stageProgress.ts";

/** The saved target wins when valid; otherwise farm the earliest unlocked stage. */
export function farmingStageID(savedID: unknown, progress: StageProgress): string {
  if (typeof savedID === "string" && stageUnlocked(progress, savedID)) return savedID;
  return STAGE_CATALOG.find((stage) => stageUnlocked(progress, stage.id))!.id;
}

/** The last server-cleared stage; highestUnlocked points at the next attempt, except at the cap. */
export function highestClearedStageID(progress: StageProgress): string | null {
  const completed = STAGE_CATALOG.filter((stage) => (progress.completed[stage.id] ?? 0) > 0 &&
    stageUnlocked(progress, stage.id));
  return completed.at(-1)?.id ?? null;
}

/** Choose a continuation only after the authoritative result has settled. */
export function continuationStageID(currentID: string, outcome: "clear" | "failed",
  before: StageProgress, after: StageProgress = before): string | null {
  const index = STAGE_CATALOG.findIndex((stage) => stage.id === currentID);
  if (index < 0 || !stageUnlocked(before, currentID)) return null;
  const wasFrontier = (before.completed[currentID] ?? 0) === 0 &&
    index === before.highestUnlocked - 1;
  if (outcome === "failed") {
    if (!wasFrontier) return currentID;
    // With no cleared stage (the first attempt at 1-1), stop instead of wiping forever.
    return highestClearedStageID(after);
  }
  if (wasFrontier && (after.completed[currentID] ?? 0) > 0) {
    const next = STAGE_CATALOG[index + 1];
    if (next && stageUnlocked(after, next.id)) return next.id;
  }
  return currentID;
}

/** A chapter tab opens as soon as its first stage is unlocked. */
export function chapterAvailable(chapter: number, progress: StageProgress): boolean {
  return STAGE_CATALOG.some((stage) => stage.chapter === chapter && stageUnlocked(progress, stage.id));
}
