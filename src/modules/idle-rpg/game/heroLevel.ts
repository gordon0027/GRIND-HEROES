import { evaluateCurve } from "@idosgames/core";
import type { CharacterDefView } from "./heroStats";

/** Enabled by the authoritative V1 ladder, leaving older environments compatible. */
export function heroLevelEnabled(def: CharacterDefView): boolean {
  return def.RankLadder?.MaxRank === 10;
}

export function heroLevelCost(def: CharacterDefView, level: number): number | null {
  const ladder = def.RankLadder;
  if (!heroLevelEnabled(def) || level < 1 || level >= 10) return null;
  const entries = Object.values(ladder?.PriceOptions ?? {}).find(Boolean)?.Cost?.Standard?.Entries;
  const entry = entries?.[0];
  if (entries?.length !== 1 || entry?.Type !== "VirtualCurrency" || entry.CurrencyID !== "GOLD") return null;
  const cost = Math.ceil(evaluateCurve(ladder?.CostCurve, Number(entry.Amount), level + 1, ladder?.FirstPaidRank ?? 1));
  return Number.isSafeInteger(cost) && cost > 0 ? cost : null;
}
