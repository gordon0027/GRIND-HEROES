/** Read Character via iDos MCP, apply this plan, then save to DEV only. */
export function heroProgressionPlan(section) {
  const next = structuredClone(section);
  for (const id of ["Knight", "Archer", "Mage"]) {
    const def = next.Definitions[id];
    if (!def?.RankLadder?.PriceOptions?.default) throw new Error(`Missing ladder: ${id}`);
    def.RankLadder.MaxRank = 10;
    def.RankLadder.FirstPaidRank = 2;
    def.RankLadder.PriceOptions.default.Cost.Standard.Entries = [
      { Type: "VirtualCurrency", CurrencyID: "GOLD", Amount: 500 },
    ];
    def.RankLadder.CostCurve = { Shape: "Geometric", GrowthRate: 0.5 };
    def.RankStatCurve = { Shape: "PerStepRate", PerStepRate: 0.04 };
  }
  return next;
}
