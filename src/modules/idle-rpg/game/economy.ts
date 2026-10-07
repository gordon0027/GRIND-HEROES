// Where the gold comes from: the title's idle accrual (Reward → IdleAccruals) — the SERVER pays it,
// at a rate that grows with the Power of the player's strongest hero. The game collects it every few
// seconds while it is on screen and once on entry ("while you were away"); the coins that pop out of
// monsters are that same stream drawn, never a second source. These helpers only READ the config to
// show the rate — the server computes what is actually paid.

export interface AccrualView {
  AccrualID?: string;
  DisplayName?: string | null;
  Rate?: {
    BaseRatePerSecond?: number | null;
    PowerCoefficient?: number | null;
    BoardRankCoefficient?: number | null;
    EquipmentBonusEnabled?: boolean | null;
    EquipmentCharacterID?: string | null;
  } | null;
  Rewards?: {
    Standard?: {
      Entries?: Array<{
        Type?: string | null;
        CurrencyID?: string | null;
        Amount?: number | null;
      } | null> | null;
    } | null;
  } | null;
  MaxAccumulationSeconds?: number | null;
  MinClaimSeconds?: number | null;
}

export interface RewardSection {
  IdleAccruals?: Record<string, AccrualView | null> | null;
}

/** The accrual the game draws as battle loot: "idle_gold" if the title has it, else the first that pays a currency. */
export const PREFERRED_ACCRUAL = "idle_gold";

export interface Income {
  accrualID: string;
  currencyID: string;
  /** Currency per unit of rate (the accrual's grant amount). */
  perUnit: number;
  base: number;
  powerCoefficient: number;
  maxSeconds: number;
  minClaimSeconds: number;
}

export function pickIncome(section: RewardSection | undefined): Income | null {
  const entries = Object.entries(section?.IdleAccruals ?? {}).filter(
    (e): e is [string, AccrualView] => !!e[1],
  );
  entries.sort(
    ([a], [b]) =>
      Number(b === PREFERRED_ACCRUAL) - Number(a === PREFERRED_ACCRUAL),
  );
  for (const [key, a] of entries) {
    const pay = a.Rewards?.Standard?.Entries?.find(
      (e) =>
        e?.CurrencyID && (e.Type ?? "VirtualCurrency") === "VirtualCurrency",
    );
    if (!pay?.CurrencyID) continue;
    return {
      accrualID: a.AccrualID ?? key,
      currencyID: pay.CurrencyID,
      perUnit: Number(pay.Amount ?? 1) || 1,
      base: Number(a.Rate?.BaseRatePerSecond ?? 0),
      powerCoefficient: Number(a.Rate?.PowerCoefficient ?? 0),
      maxSeconds: Number(a.MaxAccumulationSeconds ?? 0),
      minClaimSeconds: Number(a.MinClaimSeconds ?? 0),
    };
  }
  return null;
}

/**
 * Currency per second, as the server will compute it: base + coefficient × the strongest hero's
 * Power (premium multipliers and gear bonuses left out — a display, not a promise).
 */
export function incomePerSecond(
  income: Income,
  heroPowers: ReadonlyArray<number | null | undefined>,
): number {
  const power = Math.max(0, ...heroPowers.map((p) => Number(p ?? 0)));
  return (income.base + income.powerCoefficient * power) * income.perUnit;
}

// ── Quests that count the game's own metrics ──────────────────────────────────────────────────

/** Metrics the game reports with `client.quest.addQuestProgress`. */
export const METRIC_STAGE_CLEARED = "stage_cleared";
export const METRIC_STAT_ENHANCED = "stat_enhanced";

export interface QuestSection {
  Quests?: Record<
    string,
    {
      Objectives?: Record<
        string,
        {
          MetricID?: string | null;
          Source?: string | null;
          MaxProgressPerCall?: number | null;
        } | null
      > | null;
    } | null
  > | null;
}

/**
 * Whether some quest counts `metricID` from the client, and the most one call may add (0 = no cap).
 * `null` — nobody counts it: the call is skipped (the server refuses an unknown metric anyway).
 *
 * ⚠ The cap is the SMALLEST one among the objectives: a call above an objective's
 * MaxProgressPerCall is treated as cheating and BANS the player, it is not clamped.
 */
export function questMetric(
  section: QuestSection | undefined,
  metricID: string,
): { maxPerCall: number } | null {
  let found = false;
  let cap = 0;
  for (const q of Object.values(section?.Quests ?? {}))
    for (const o of Object.values(q?.Objectives ?? {})) {
      if (!o || o.MetricID !== metricID) continue;
      if ((o.Source ?? "ClientApi") !== "ClientApi") continue;
      found = true;
      const max = Number(o.MaxProgressPerCall ?? 0);
      if (max > 0) cap = cap === 0 ? max : Math.min(cap, max);
    }
  return found ? { maxPerCall: cap } : null;
}
