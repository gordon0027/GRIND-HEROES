// Pure helpers of the quests screen: quest rows with the player's progress, the cycle tabs and the
// quest points track. No React, no client calls — covered by model.test.ts against the module's own
// demo settings.

import type { ResourceGrant } from "@idosgames/core";
import { grantLines, mergeLines, type ResourceLine } from "@idosgames/react/ui";

// ── Configuration (the fields this screen reads) ─────────────────────────────────────────────

export interface QuestObjectiveView {
  ObjectiveID?: string;
  DisplayName?: string | null;
  MetricID?: string | null;
  TargetValue?: number;
  Source?: string;
}

export interface QuestDefinitionView {
  QuestID?: string;
  Identity?: {
    DisplayName?: string | null;
    Description?: string | null;
  } | null;
  Linking?: { CycleIDs?: string[] | null } | null;
  Objectives?: Record<string, QuestObjectiveView | null> | null;
  Reward?: { Grant?: ResourceGrant | null } | null;
}

export interface QuestMilestoneView {
  MilestoneID?: string | null;
  DisplayName?: string | null;
  RequiredProgress?: number | null;
  Rewards?: ResourceGrant | null;
}

export interface QuestCycleView {
  CycleID?: string;
  DisplayName?: string | null;
  Milestones?: Record<string, QuestMilestoneView | null> | null;
}

export interface QuestSection {
  Cycles?: Record<string, QuestCycleView | null> | null;
  Quests?: Record<string, QuestDefinitionView | null> | null;
}

export interface QuestProgressView {
  Status?: string;
  Objectives?: Record<
    string,
    { ObjectiveID?: string; CurrentValue?: number; Completed?: boolean } | null
  > | null;
}

export interface QuestStateView {
  Cycles?: Record<
    string,
    {
      Quests?: Record<string, QuestProgressView | null> | null;
      CycleEndUtc?: string | null;
    } | null
  > | null;
  PermanentQuests?: Record<string, QuestProgressView | null> | null;
}

// ── Quests ───────────────────────────────────────────────────────────────────────────────────

export interface ObjectiveRow {
  id: string;
  name: string;
  progress: number;
  target: number;
  done: boolean;
}

export interface QuestRow {
  questID: string;
  /** undefined — a permanent quest. */
  cycleID: string | undefined;
  name: string;
  description: string;
  status: "Active" | "Completed" | "Claimed" | "Expired";
  progress: number;
  target: number;
  objectives: ObjectiveRow[];
  reward: ResourceLine[];
}

/**
 * Quests with the player's progress. One bar per quest is the SUM over its objectives against the
 * sum of targets (Unity quest window); the detail popup lists every objective.
 */
export function questRows(
  section: QuestSection | undefined,
  state: QuestStateView | null | undefined,
): QuestRow[] {
  const rows: QuestRow[] = [];
  for (const [id, def] of Object.entries(section?.Quests ?? {})) {
    if (!def) continue;
    const questID = def.QuestID ?? id;
    const cycleID = def.Linking?.CycleIDs?.[0] ?? undefined;
    const progress = cycleID
      ? state?.Cycles?.[cycleID]?.Quests?.[questID]
      : state?.PermanentQuests?.[questID];
    const status = (progress?.Status ?? "Active") as QuestRow["status"];

    const objectives: ObjectiveRow[] = Object.entries(def.Objectives ?? {})
      .filter(([, o]) => o)
      .map(([oid, o]) => {
        const objectiveID = o?.ObjectiveID ?? oid;
        const target = Math.max(1, Number(o?.TargetValue ?? 1));
        const p = progress?.Objectives?.[objectiveID];
        const done =
          status === "Completed" ||
          status === "Claimed" ||
          p?.Completed === true;
        return {
          id: objectiveID,
          name: o?.DisplayName || objectiveID,
          target,
          progress: done
            ? target
            : Math.min(target, Number(p?.CurrentValue ?? 0)),
          done,
        };
      });
    const target = objectives.reduce((s, o) => s + o.target, 0) || 1;
    const current = objectives.reduce((s, o) => s + o.progress, 0);

    rows.push({
      questID,
      cycleID,
      name: def.Identity?.DisplayName || questID,
      description: def.Identity?.Description || "",
      status,
      progress:
        status === "Completed" || status === "Claimed" ? target : current,
      target,
      objectives,
      reward: grantLines(def.Reward?.Grant),
    });
  }
  // Ready to claim first, then in progress, then done.
  const weight = { Completed: 0, Active: 1, Claimed: 2, Expired: 3 } as const;
  return rows.sort(
    (a, b) =>
      weight[a.status] - weight[b.status] || a.questID.localeCompare(b.questID),
  );
}

/** The quest tabs: cycles that have quests, then "permanent" when there are cycle-less quests. */
export function questTabs(
  section: QuestSection | undefined,
  rows: QuestRow[],
): Array<{ id: string; name: string }> {
  const used = new Set(rows.map((r) => r.cycleID ?? ""));
  const tabs = Object.entries(section?.Cycles ?? {})
    .map(([id, c]) => ({ id: c?.CycleID ?? id, name: c?.DisplayName || id }))
    .filter((c) => used.has(c.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (used.has("")) tabs.push({ id: "", name: "" });
  return tabs;
}

/** Everything a "Claim all" collects (the reward preview of the batch). */
export function claimableRewards(rows: QuestRow[]): ResourceLine[] {
  return mergeLines(
    rows.filter((r) => r.status === "Completed").flatMap((r) => r.reward),
  );
}

// ── Points track ─────────────────────────────────────────────────────────────────────────────

export interface TrackMilestone {
  id: string;
  name: string;
  required: number;
  reward: ResourceLine[];
  state: "claimed" | "ready" | "locked";
}

/** Milestones of a cycle's quest points track (Unity QuestWindowMilestoneController). */
export function trackMilestones(
  cycle: QuestCycleView | null | undefined,
  points: number,
  claimed: readonly string[],
): TrackMilestone[] {
  return Object.entries(cycle?.Milestones ?? {})
    .map(([id, m]) => ({ id: m?.MilestoneID ?? id, m }))
    .filter((x): x is { id: string; m: QuestMilestoneView } => !!x.m)
    .sort(
      (a, b) =>
        Number(a.m.RequiredProgress ?? 0) - Number(b.m.RequiredProgress ?? 0),
    )
    .map(({ id, m }) => {
      const required = Number(m.RequiredProgress ?? 0);
      return {
        id,
        name: m.DisplayName || id,
        required,
        reward: grantLines(m.Rewards),
        state: claimed.includes(id)
          ? "claimed"
          : points >= required
            ? "ready"
            : "locked",
      };
    });
}

/** Badge of the quests screen: finished quests and track rewards waiting. */
export function questsBadge(rows: QuestRow[], trackReady: number): number {
  return rows.filter((r) => r.status === "Completed").length + trackReady;
}

/** Whether the title has quests — until it does, the lobby hides the tab. */
/**
 * When a cycle's quests reset, or null when they never do. A cycle without a reset (schedule
 * AlwaysOn — a guide chain, permanent tasks) comes from the engine with CycleEndUtc =
 * DateTime.MaxValue (9999-12-31): the engine keeps it as the window's key, and the screen counted
 * down to it — "New quests in 2912168d".
 */
export function cycleResetAt(
  state: QuestStateView | null | undefined,
  cycleID: string,
): string | null {
  const end = cycleID ? state?.Cycles?.[cycleID]?.CycleEndUtc : null;
  if (!end) return null;
  const year = new Date(end).getUTCFullYear();
  return Number.isFinite(year) && year < NEVER_YEAR ? end : null;
}

/** From this year on a date is the engine's "never" (DateTime.MaxValue), not a real moment. */
const NEVER_YEAR = 9000;

export function hasTitleData(quest: QuestSection | undefined): boolean {
  return Object.keys(quest?.Quests ?? {}).length > 0;
}
