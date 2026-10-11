import { FIRST_STAGE, type EncounterDefinition, type EnemyDefinition, type StageDefinition } from "./stageRun.ts";
import { enemyDensity } from "./encounterLayout.ts";
import { stageHeroXP } from "./heroXP.ts";

export const STAGES_PER_CHAPTER = 10;
export const INITIAL_CHAPTERS = 3;

export function stageID(chapter: number, stage: number): string {
  return `grind-stage-${chapter}-${stage}`;
}

export function stageLabel(chapter: number, stage: number): string {
  return `${chapter}-${stage}`;
}

const chapterNames = ["Meadow Road", "Orange Bastion", "Undead Crypt"];
const legacyLengths = [5000, 5500, 6000, 6500, 7500];
const LENGTH_FACTOR = 0.9;
const ACT_GOLD_START = [100, 420, 900] as const;
const ACT_GOLD_PER_STAGE = [25, 40, 60] as const;
const ACT_POWER_START = [80, 340, 740] as const;
const ACT_POWER_END = [300, 680, 1100] as const;
const stageLength = (index: number) => Math.round((legacyLengths[index] ?? 7500 + (index - 4) * 150) * LENGTH_FACTOR / 50) * 50;
const stageGold = (index: number) => {
  const act = Math.floor(index / STAGES_PER_CHAPTER);
  return ACT_GOLD_START[act]! + ACT_GOLD_PER_STAGE[act]! * (index % STAGES_PER_CHAPTER);
};
const stagePower = (chapter: number, stage: number) => {
  const act = chapter - 1;
  return Math.round(ACT_POWER_START[act]! + (ACT_POWER_END[act]! - ACT_POWER_START[act]!) *
    (stage - 1) / (STAGES_PER_CHAPTER - 1));
};
type EnemyRole = "simple" | "fat" | "archer" | "heavy";

const actEnemies: Record<2 | 3, Record<string, EnemyDefinition>> = {
  2: {
    simple: { type: "Orange Goblin", visual: "orange1", maxHp: 45, attack: 5, defence: 1,
      attackSpeed: 0.9, moveSpeed: 0.48, attackRange: 0.10 },
    fat: { type: "Orange Goblin Fat", visual: "orangeFat", maxHp: 72, attack: 5, defence: 3,
      attackSpeed: 0.7, moveSpeed: 0.34, attackRange: 0.11 },
    archer: { type: "Orange Goblin Archer", visual: "orangeArcher", maxHp: 34, attack: 5, defence: 0,
      attackSpeed: 0.7, moveSpeed: 0.36, attackRange: 0.42, combatType: "RANGED",
      projectile: { type: "ARROW", speed: 1.35, releaseDelay: 0.19 } },
    heavy: { type: "Orange Goblin Heavy", visual: "orangeHeavy", maxHp: 88, attack: 8, defence: 3,
      attackSpeed: 0.62, moveSpeed: 0.33, attackRange: 0.12 },
    boss: { type: "Orange Ogre", visual: "orangeOgre", maxHp: 230, attack: 9, defence: 3,
      attackSpeed: 0.65, moveSpeed: 0.28, attackRange: 0.13 },
  },
  3: {
    simple: { type: "Undead Warrior", visual: "undead1", maxHp: 80, attack: 7, defence: 2,
      attackSpeed: 0.85, moveSpeed: 0.42, attackRange: 0.10 },
    archer: { type: "Undead Archer", visual: "undeadArcher", maxHp: 58, attack: 7, defence: 1,
      attackSpeed: 0.75, moveSpeed: 0.34, attackRange: 0.42, combatType: "RANGED",
      projectile: { type: "ARROW", speed: 1.35, releaseDelay: 0.19 } },
    heavy: { type: "Undead Heavy", visual: "undeadHeavy", maxHp: 130, attack: 10, defence: 4,
      attackSpeed: 0.58, moveSpeed: 0.30, attackRange: 0.12 },
    boss: { type: "Zombie Ogre", visual: "zombieOgre", maxHp: 465, attack: 12, defence: 5,
      attackSpeed: 0.58, moveSpeed: 0.26, attackRange: 0.14 },
  },
};

/** Larger packs share the old encounter HP budget; threat grows through composition. */
function regularEnemy(chapter: number, stage: number, wave: number, totalWaves: number,
  member: number, count: number): EnemyDefinition {
  const progress = stage - 1;
  const pressure = 0.88 + 0.24 * wave / (totalWaves - 1);
  if (chapter === 1) {
    const variant = wave === 0 ? member % 2 : (stage + wave + member) % 3;
    return {
      type: ["Goblin Scout", "Goblin Raider", "Goblin Brute"][variant]!,
      visual: ["goblin1", "goblin2", "goblinboss"][variant]!,
      maxHp: Math.round((14 + variant * 4 + progress * 1.6) * pressure),
      attack: 1 + Math.floor(progress / 4) + (variant === 2 ? 1 : 0),
      defence: variant === 0 ? 0 : 1,
      attackSpeed: variant === 2 ? 0.60 : 0.72,
      moveSpeed: variant === 2 ? 0.36 : 0.44, attackRange: 0.10 + variant * 0.01,
    };
  }
  // One or two backline archers, at most two heavies. Fat frontliners vary Act 2 packs.
  const archerCount = wave === 0 ? 0 : count >= 5 && wave % 3 === 2 ? 2 : 1;
  const role: EnemyRole = member >= count - archerCount ? "archer" :
    member === 1 && wave > 0 ? (chapter === 2 && wave % 2 === 1 ? "fat" : "heavy") :
      member === 3 && wave >= totalWaves - 2 ? "heavy" : "simple";
  const source = actEnemies[chapter as 2 | 3][role]!;
  return { ...source,
    maxHp: Math.round(source.maxHp * (chapter === 2 ? 0.63 : 0.60) *
      (1 + progress * 0.075) * pressure),
    attack: Math.max(2, source.attack - 1 + Math.floor(progress / 4)) +
      (chapter === 3 ? 2 + Math.floor(progress / 3) : 0),
    attackSpeed: source.attackSpeed * 0.88,
    defence: source.defence + Math.floor(progress / 6),
  };
}

function stageEncounters(chapter: number, stage: number, id: string, length: number): EncounterDefinition[] {
  const [low, high] = enemyDensity(chapter, stage);
  const waveCount = chapter === 3 ? 7 : chapter === 2 || stage >= 7 ? 6 : 5;
  return Array.from({ length: waveCount }, (_, wave) => {
    const count = low + (low === 1 ? Number(wave > 0) :
      Math.round((high - low) * wave / (waveCount - 1)));
    return { id: `${id}-encounter-${wave + 1}`,
      distance: Math.round(length * (0.12 + wave * 0.74 / (waveCount - 1))),
      enemies: Array.from({ length: count }, (_, member) =>
        regularEnemy(chapter, stage, wave, waveCount, member, count)),
    };
  });
}

/** Chapter count is content, not a condition in the runtime or progression controller. */
export function makeStage(chapter: number, stage: number): StageDefinition {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > INITIAL_CHAPTERS ||
      !Number.isInteger(stage) || stage < 1 || stage > STAGES_PER_CHAPTER)
    throw new Error("Invalid chapter-stage identity");
  if (chapter === 1 && stage === 1) return FIRST_STAGE;
  const index = (chapter - 1) * STAGES_PER_CHAPTER + stage - 1;
  const id = stageID(chapter, stage);
  const length = stageLength(index);
  const encounters = stageEncounters(chapter, stage, id, length);
  const source = chapter === 1 ? FIRST_STAGE.boss.enemies[0]! : actEnemies[chapter as 2 | 3].boss!;
  const boss: EncounterDefinition = { id: `${id}-boss`, distance: length, enemies: [{ ...source,
    maxHp: Math.round(source.maxHp * (1 + (stage - 1) * (chapter === 1 ? 0.18 : 0.08))),
    attack: source.attack + Math.floor((stage - 1) / 4) +
      (chapter === 3 ? 2 + Math.floor((stage - 1) / 3) : 0),
    defence: source.defence + Math.floor((stage - 1) / 6),
  }] };
  const guardCount = chapter === 3 && stage >= 6 ? 2 : chapter >= 2 && stage >= 5 ? 1 : 0;
  for (let guard = 0; guard < guardCount; guard++)
    boss.enemies.push(regularEnemy(chapter, stage, 0, 2, guard, guardCount));
  return {
    id, chapter, stage,
    name: `${stageLabel(chapter, stage)} · ${chapterNames[chapter - 1]}`,
    length,
    environment: chapter === 1 ? "forest" : `act${chapter}`,
    unlockRequirement: stageID(stage === 1 ? chapter - 1 : chapter,
      stage === 1 ? STAGES_PER_CHAPTER : stage - 1),
    recommendedPower: stagePower(chapter, stage),
    minimumClearSeconds: 7 + Math.floor(index / 3),
    rewards: { repeat: { gold: stageGold(index), heroXP: stageHeroXP(chapter, stage),
      chestItemID: "stage_chest", bossChestItemID: stage % 5 === 0 ? "boss_chest" : null } },
    encounters, boss,
  };
}

export const STAGE_CATALOG: readonly StageDefinition[] = Array.from(
  { length: INITIAL_CHAPTERS * STAGES_PER_CHAPTER }, (_, index) =>
    makeStage(Math.floor(index / STAGES_PER_CHAPTER) + 1, index % STAGES_PER_CHAPTER + 1));

export function stageByID(id: string): StageDefinition | null {
  return STAGE_CATALOG.find((stage) => stage.id === id) ?? null;
}

export function nextStageID(id: string): string | null {
  const index = STAGE_CATALOG.findIndex((stage) => stage.id === id);
  return index >= 0 ? STAGE_CATALOG[index + 1]?.id ?? null : null;
}
