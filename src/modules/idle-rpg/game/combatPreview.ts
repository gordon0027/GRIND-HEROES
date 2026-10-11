import { heroArchetype } from "./heroArchetypes.ts";
import type { HeroSource } from "./stageRun.ts";

export type PreviewTier = "starter" | "Common" | "Uncommon" | "Rare" | "Epic";

/** Local DEV fixtures, matching the audited six-slot item matrix and paid stats. */
export function previewParty(tier: PreviewTier, count: number): HeroSource[] {
  const index = ["Common", "Uncommon", "Rare", "Epic"].indexOf(tier);
  const enhancement = index < 0 ? 0 : [0, 3, 8, 14][index]!;
  const weapon = index < 0 ? 0 : [5, 9, 15, 24][index]!;
  const glove = index < 0 ? 0 : [1, 2, 3, 5][index]!;
  const sharedHp = index < 0 ? 0 : [60, 97, 140, 200][index]!;
  const sharedDef = index < 0 ? 0 : [2, 4, 6, 8][index]!;
  const gloveSpeed = index < 0 ? 0 : [0.03, 0.05, 0.07, 0.1][index]!;
  return ["Knight", "Archer", "Mage"].slice(0, Math.max(1, Math.min(3, count))).map((id) => {
    const role = heroArchetype(id);
    const knight = id === "Knight", mage = id === "Mage";
    const offhand = index < 0 ? 0 : mage ? [3, 5, 8, 12][index]! : knight ? 0 : glove;
    return { id, classId: id, level: index < 0 ? 1 : [1, 5, 10, 15][index]!,
      maxHp: (knight ? 120 : mage ? 80 : 90) + enhancement * (knight ? 24 : mage ? 16 : 18) +
        sharedHp + (knight && index >= 0 ? [25, 40, 60, 85][index]! : 0),
      attack: ((knight ? 10 : mage ? 22 : 9) + enhancement * (knight ? 2 : mage ? 4.4 : 1.8) +
        weapon + glove + offhand) * role.hit,
      defence: sharedDef + (knight && index >= 0 ? [2, 3, 4, 6][index]! : 0),
      attackSpeed: ((knight ? 1 : mage ? 0.8 : 1.4) + gloveSpeed * (id === "Archer" ? 2 : 1)) * role.cadence,
      moveSpeed: role.moveSpeed + (index < 0 ? 0 : [5, 8, 11, 14][index]!),
      attackRange: role.attackRange, combatType: role.combatType, projectile: role.projectile,
    };
  });
}
