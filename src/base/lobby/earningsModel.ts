export interface EarningsOverview {
  status: string;
  day: string | null;
  budgetRemainingUnits: string | null;
  dailyBudgetUnits: string | null;
  participantCount: number | null;
  rank: number | null;
  power: number | null;
  dailyShareUnits: string | null;
  currentWindowUnits: string | null;
  inactiveCreditUnits: string | null;
  pendingReviewUnits: string | null;
  paidTotalUnits: string | null;
  claimedWindow: boolean | null;
  cooldownUntilUtc: string | null;
  window: number | null;
  nextWindowAtUtc: string | null;
  updatedAtUtc: string | null;
}

// The UI never turns a missing field into an invented zero or a rounded token amount.
export function parseEarnings(value: unknown): EarningsOverview {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid earnings response");
  const data = value as Record<string, unknown>;
  if (typeof data.status !== "string" || !data.status) throw new Error("Missing earnings status");
  const units = (key: string) => {
    if (data[key] == null) return null;
    if (typeof data[key] !== "string" || !/^(0|[1-9]\d*)$/.test(data[key])) throw new Error(`Invalid ${key}`);
    return data[key] as string;
  };
  const integer = (key: string, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    if (data[key] == null) return null;
    if (!Number.isSafeInteger(data[key]) || Number(data[key]) < min || Number(data[key]) > max) throw new Error(`Invalid ${key}`);
    return data[key] as number;
  };
  const date = (key: string) => {
    if (data[key] == null) return null;
    if (typeof data[key] !== "string" || !Number.isFinite(Date.parse(data[key])) ||
      (key === "day" ? !/^\d{4}-\d{2}-\d{2}$/.test(data[key]) || new Date(data[key]).toISOString().slice(0,10) !== data[key]
        : !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(data[key]))) throw new Error(`Invalid ${key}`);
    return data[key] as string;
  };
  if (data.claimedWindow != null && typeof data.claimedWindow !== "boolean") throw new Error("Invalid claimedWindow");
  return {
    status: data.status, day: date("day"), budgetRemainingUnits: units("budgetRemainingUnits"),
    dailyBudgetUnits: units("dailyBudgetUnits"), participantCount: integer("participantCount"), rank: integer("rank", 1, 100),
    power: integer("power"), dailyShareUnits: units("dailyShareUnits"), currentWindowUnits: units("currentWindowUnits"),
    inactiveCreditUnits: units("inactiveCreditUnits"), pendingReviewUnits: units("pendingReviewUnits"), paidTotalUnits: units("paidTotalUnits"),
    claimedWindow: data.claimedWindow as boolean | null ?? null, cooldownUntilUtc: date("cooldownUntilUtc"),
    window: integer("window", 1, 3), nextWindowAtUtc: date("nextWindowAtUtc"), updatedAtUtc: date("updatedAtUtc"),
  };
}

export const ghAmount = (value: string | null) => value === null ? "—" : `${BigInt(value).toLocaleString("en-US")} GH`;
export const utcTime = (value: string | null) => value === null ? "Unavailable" :
  new Intl.DateTimeFormat("en-GB", {timeZone:"UTC",dateStyle:"medium",timeStyle:"short"}).format(new Date(value)) + " UTC";

export function earningsStatus(data: EarningsOverview): string {
  if (data.status === "review_required") return "A previous payout is reserved for review. It is not a confirmed payment.";
  if (data.status === "disabled") return "Reward accounting is paused. No new allocation is available.";
  if (data.status === "empty_leaderboard") return "There are no eligible participants in today's snapshot.";
  if (data.status === "insufficient_budget") return "The reward budget is too small for today's allocation.";
  if (["not_started", "catchup_pending"].includes(data.status)) return "Today's reward snapshot is not ready. Check again later.";
  if (data.status === "cooldown") return `Accounting cooldown until ${utcTime(data.cooldownUntilUtc)}. Payouts remain unavailable.`;
  if (data.claimedWindow) return "This reward window has already been recorded as claimed.";
  if (data.status === "available") return "An accounting allocation is calculated for this window. It is not currently claimable.";
  if (data.status === "nothing_owed") return "No new allocation is recorded for this reward window.";
  return "Reward availability is not confirmed. Check again later.";
}
