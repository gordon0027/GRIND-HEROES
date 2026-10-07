export type ChestKind = "stage_chest" | "boss_chest";

export function chestIDs(kind: ChestKind): readonly string[] {
  return [kind, `${kind}_act2`, `${kind}_act3`];
}

export function chestPool(kind: ChestKind, counts: Readonly<Record<string, number>>,
  definitions: Readonly<Record<string, unknown>>): { lootboxID: string; priceID: string } | null {
  const base = kind === "stage_chest" ? "gear_summon" : "boss_summon";
  const priceID = kind === "stage_chest" ? "stage" : "boss";
  for (const act of [3, 2] as const) {
    const lootboxID = `${base}_act${act}`;
    if ((counts[`${kind}_act${act}`] ?? 0) > 0 && definitions[lootboxID]) return { lootboxID, priceID };
  }
  return (counts[kind] ?? 0) > 0 && definitions[base] ? { lootboxID: base, priceID } : null;
}
