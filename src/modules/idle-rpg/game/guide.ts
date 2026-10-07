// Which quest the strip over the Enhance list shows (Legend Slime's "Claim Rewards: Enhance HP").
// A reward waiting comes first; then the next step of the guide chain; then any open quest. The
// quests system draws the full list — this is one line of it, kept in the player's eye.

export const GUIDE_CYCLE = "guide";

export interface QuestDefView {
  QuestID?: string;
  Identity?: { DisplayName?: string | null } | null;
  Linking?: {
    CycleIDs?: string[] | null;
    RequiredQuestIDs?: string[] | null;
  } | null;
  Reward?: { Grant?: unknown } | null;
  Objectives?: Record<string, { TargetValue?: number | null } | null> | null;
}

export interface QuestConfigView {
  Quests?: Record<string, QuestDefView | null> | null;
}

interface ProgressView {
  Status?: string | null;
  Objectives?: Record<string, { CurrentValue?: number | null } | null> | null;
}

export interface QuestStateView {
  Cycles?: Record<
    string,
    { Quests?: Record<string, ProgressView | null> | null } | null
  > | null;
  PermanentQuests?: Record<string, ProgressView | null> | null;
}

export interface GuideView {
  questID: string;
  cycleID: string | undefined;
  name: string;
  current: number;
  target: number;
  claimable: boolean;
  grant: unknown;
}

export function pickGuide(
  section: QuestConfigView | undefined,
  state: QuestStateView | undefined,
): GuideView | null {
  const progressOf = (id: string, cycle: string | undefined) =>
    (cycle ? state?.Cycles?.[cycle]?.Quests?.[id] : undefined) ??
    state?.PermanentQuests?.[id] ??
    undefined;
  const claimed = (id: string) => {
    const q = section?.Quests?.[id];
    return progressOf(id, q?.Linking?.CycleIDs?.[0])?.Status === "Claimed";
  };

  const views: GuideView[] = [];
  for (const [key, q] of Object.entries(section?.Quests ?? {})) {
    if (!q) continue;
    const id = q.QuestID ?? key;
    const cycleID = q.Linking?.CycleIDs?.[0] ?? undefined;
    const p = progressOf(id, cycleID);
    const status = p?.Status ?? "Active";
    if (status === "Claimed" || status === "Expired") continue;
    if (!(q.Linking?.RequiredQuestIDs ?? []).every(claimed)) continue;
    const [objID, obj] = Object.entries(q.Objectives ?? {})[0] ?? [];
    const target = Math.max(1, Number(obj?.TargetValue ?? 1));
    const current = Math.min(
      target,
      Number(objID ? (p?.Objectives?.[objID]?.CurrentValue ?? 0) : 0),
    );
    views.push({
      questID: id,
      cycleID,
      name: q.Identity?.DisplayName ?? id,
      current,
      target,
      claimable: status === "Completed",
      grant: q.Reward?.Grant,
    });
  }
  return (
    views.find((g) => g.claimable) ??
    views.find((g) => g.cycleID === GUIDE_CYCLE) ??
    views[0] ??
    null
  );
}
