import { STAGE_CATALOG } from "./stageCatalog.ts";
import { stageUnlocked, type StageProgress } from "./stageProgress.ts";

/** The saved target wins when valid; otherwise farm the earliest unlocked stage. */
export function farmingStageID(savedID: unknown, progress: StageProgress): string {
  if (typeof savedID === "string" && stageUnlocked(progress, savedID)) return savedID;
  return STAGE_CATALOG.find((stage) => stageUnlocked(progress, stage.id))!.id;
}

/** Both outcomes restart the selected target. Unlocking does not move the target. */
export function continuationStageID(currentID: string, _outcome: "clear" | "failed" = "clear"): string {
  return currentID;
}

/** A chapter tab opens as soon as its first stage is unlocked. */
export function chapterAvailable(chapter: number, progress: StageProgress): boolean {
  return STAGE_CATALOG.some((stage) => stage.chapter === chapter && stageUnlocked(progress, stage.id));
}
