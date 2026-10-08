// This is the single Grind Heroes Power formula. The CloudCode publisher strips
// the export keyword and prepends this exact source to the server revision.
export function ghCombatPower(stats) {
  return Math.round(stats.attack * 2 + stats.maxHp / 10 + stats.defence * 3
    + stats.attackSpeed * 20 + stats.moveSpeed / 5);
}
