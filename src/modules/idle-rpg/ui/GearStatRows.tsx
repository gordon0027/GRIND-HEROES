import type { ReactNode } from "react";
import { GEAR_STATS, compareGear, type GearBonuses, type GearItem, type GearStat } from "../game/equipment";

const statFields: Record<GearStat, keyof GearBonuses> = {
  Attack: "attack", "Max HP": "maxHp", Defence: "defence", "Attack Speed": "attackSpeed", "Move Speed": "moveSpeed",
};

export function GearStatRows({ item, comparedWith, relevantOnly = false }: {
  item: GearItem; comparedWith?: GearItem | null; relevantOnly?: boolean;
}): ReactNode {
  const delta = comparedWith === undefined ? null : compareGear(item, comparedWith);
  const number = (value: number) => Number(value.toFixed(2)).toString();
  const stats = relevantOnly ? GEAR_STATS.filter((stat) => item.bonuses[statFields[stat]] !== 0) : GEAR_STATS;
  return <div className="gh-item-detail__stats">{stats.map((stat) => {
    const field = statFields[stat];
    const change = delta?.[field];
    return <div key={stat}><span>{stat}</span><strong>{number(item.bonuses[field])}</strong>
      {change !== undefined ? <em className={change < 0 ? "negative" : change > 0 ? "positive" : "neutral"}>
        {change > 0 ? "+" : ""}{number(change)}</em> : null}</div>;
  })}</div>;
}
