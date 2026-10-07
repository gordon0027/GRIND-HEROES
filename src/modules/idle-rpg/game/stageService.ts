import type { IDosGamesClient } from "@idosgames/core";
import { parseStageProgress, STAGE_PROGRESS_KEY, type StageProgress } from "./stageProgress";
import { parseHeroProgress, type HeroProgressMap } from "./heroXP";

export interface StartedStageRun {
  runId: string;
  stageId: string;
  minimumClearSeconds: number;
}

export interface CompletedStageRun {
  stageId: string;
  runId: string;
  serverSeconds: number;
  firstClear: boolean;
  progress: StageProgress;
  rewards: { gold: number; chestItemID: string; bossChestItemID: string | null; firstItemID: string | null };
  xpAwards: Array<{ heroID: string; amount: number; previousLevel: number; level: number; xp: number }>;
  xpEligibility: Array<{ heroID: string; activeMs: number; runMs: number; ratio: number;
    eligible: boolean; reason: string; xpGranted: number }>;
  heroProgress: HeroProgressMap;
}

function scriptError(response: { Error?: { Error?: string | null; Message?: string | null } | null }): string | null {
  return response.Error ? `${response.Error.Error ?? "CloudCode"}: ${response.Error.Message ?? "script failed"}` : null;
}

/** Only CloudCode may validate a clear or write protected stage progress. */
export class StageService {
  constructor(private readonly client: IDosGamesClient) {}

  async loadProgress(): Promise<StageProgress> {
    const result = await this.client.userCustomData.getMyUserCustomData();
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    return parseStageProgress(result.data.ReadOnly?.[STAGE_PROGRESS_KEY]?.Value);
  }

  private async execute(name: string, args: Record<string, string>): Promise<Record<string, unknown>> {
    const result = await this.client.cloudCode.execute(name, args);
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    const error = scriptError(result.data);
    if (error) throw new Error(error);
    const payload = result.data.FunctionResult;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new Error(`${name} returned no valid result`);
    return payload as Record<string, unknown>;
  }

  async start(stageId: string): Promise<StartedStageRun> {
    const value = await this.execute("startStageRun", { stageId });
    if (value.accepted !== true || typeof value.runId !== "string")
      throw new Error(String(value.reason ?? "stage start rejected"));
    return { runId: value.runId, stageId, minimumClearSeconds: Number(value.minimumClearSeconds ?? 0) };
  }

  async complete(stageId: string, runId: string): Promise<CompletedStageRun> {
    const value = await this.execute("completeStageRun", { stageId, runId });
    if (value.accepted !== true || value.stageId !== stageId || value.runId !== runId)
      throw new Error(String(value.reason ?? "stage completion rejected"));
    const progress = parseStageProgress(JSON.stringify(value.progress));
    const rewards = value.rewards as CompletedStageRun["rewards"] | undefined;
    if (!rewards || typeof rewards.gold !== "number" || rewards.chestItemID !== "stage_chest" ||
        (rewards.bossChestItemID !== null && rewards.bossChestItemID !== "boss_chest"))
      throw new Error("Stage reward result was incomplete");
    return { stageId, runId, serverSeconds: Number(value.serverSeconds),
      firstClear: value.firstClear === true, progress, rewards,
      xpAwards: Array.isArray(value.xpAwards) ? value.xpAwards as CompletedStageRun["xpAwards"] : [],
      xpEligibility: Array.isArray(value.xpEligibility) ?
        value.xpEligibility as CompletedStageRun["xpEligibility"] : [],
      heroProgress: parseHeroProgress(JSON.stringify(value.heroProgress ?? {})) };
  }

  /** Refresh the active marker from server-owned equipment and saved formation. */
  async syncParty(runId: string): Promise<void> {
    const value = await this.execute("syncStageRunParty", { runId });
    if (value.synced !== true) throw new Error(String(value.reason ?? "stage party sync rejected"));
  }

  async fail(runId: string): Promise<void> {
    await this.execute("failStageRun", { runId });
  }
}
