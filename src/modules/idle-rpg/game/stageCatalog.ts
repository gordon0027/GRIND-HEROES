import { FIRST_STAGE, type EncounterDefinition, type EnemyDefinition, type StageDefinition } from "./stageRun.ts";
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
const ACT_GOLD_START = [0, 80, 200] as const;
const ACT_GOLD_PER_STAGE = [0, 10, 20] as const;
const ACT_POWER_START = [80, 240, 450] as const;
const ACT_POWER_END = [220, 420, 680] as const;
const stageLength = (index: number) => Math.round((legacyLengths[index] ?? 7500 + (index - 4) * 150) * LENGTH_FACTOR / 50) * 50;
const stageGold = (index: number) => {
  const act = Math.floor(index / STAGES_PER_CHAPTER);
  return 30 + 8 * index + ACT_GOLD_START[act]! + ACT_GOLD_PER_STAGE[act]! * (index % STAGES_PER_CHAPTER);
};
const stagePower = (chapter: number, stage: number) => {
  const act = chapter - 1;
  return Math.round(ACT_POWER_START[act]! + (ACT_POWER_END[act]! - ACT_POWER_START[act]!) *
    (stage - 1) / (STAGES_PER_CHAPTER - 1));
};
const act1Visuals = ["goblin1", "goblin2", "goblinboss"] as const;
const act1Names = ["Goblin Scout", "Goblin Raider", "Goblin Brute"] as const;
const act1HpWeight = [1, 1.15, 1.3] as const;

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

/** Ordered waves keep archers behind melee units and make each stage readable. */
function encounterRoles(chapter: 2 | 3, stage: number): EnemyRole[][] {
  const guard: EnemyRole = chapter === 2 ? "fat" : "heavy";
  if (stage <= 2) return [["simple"], ["simple", "simple"], [guard, "simple"],
    stage === 1 ? ["simple", guard] : ["simple", "archer"], [guard, "simple"]];
  if (stage <= 5) return [["simple", "simple"], [guard, "simple"],
    [guard, "archer"], ["simple", "archer"], [guard, "simple", "archer"]];
  if (stage <= 8) return [["simple", "archer"], ["heavy", "simple"],
    ["heavy", "archer"], [guard, "simple"], ["simple", "heavy", "archer"]];
  return [["heavy", "simple"], [guard, "archer"],
    ["heavy", "simple", "archer"], ["simple", "heavy"], ["simple", "heavy", "archer"]];
}

function act1Encounter(source: EncounterDefinition, index: number, number: number,
  id: string, length: number, boss: boolean): EncounterDefinition {
  return {
    id: `${id}-${boss ? "boss" : `encounter-${number + 1}`}`,
    distance: boss ? length : Math.round(length * source.distance / FIRST_STAGE.length),
    enemies: source.enemies.map((enemy, enemyNumber) => {
      const variant = (index + number + enemyNumber) % act1Visuals.length;
      const sourceVariant = enemy.visual === "goblinboss" ? 2 : enemy.visual === "goblin2" ? 1 : 0;
      return { ...enemy,
        type: boss ? "Ogre Boss" : act1Names[variant]!,
        visual: boss ? "ogreboss" : act1Visuals[variant]!,
        maxHp: Math.round(enemy.maxHp * (boss ? 1 + index * 0.22 :
          act1HpWeight[variant]! / act1HpWeight[sourceVariant]! * (1 + index * 0.10))),
        attack: Math.max(1, enemy.attack + Math.floor(index / 3) + (boss ? 0 : Math.max(0, variant - sourceVariant))),
        defence: enemy.defence + Math.floor(index / 5),
      };
    }),
  };
}

function actEncounter(chapter: 2 | 3, stage: number, id: string, length: number,
  roles: EnemyRole[], number: number): EncounterDefinition {
  const progress = stage - 1;
  const base = actEnemies[chapter];
  return {
    id: `${id}-encounter-${number + 1}`,
    distance: Math.round(length * FIRST_STAGE.encounters[number]!.distance / FIRST_STAGE.length),
    enemies: roles.map((role) => {
      const source = base[role]!;
      return { ...source,
        maxHp: Math.round(source.maxHp * (1 + progress * 0.09)),
        attack: source.attack + Math.floor(progress / 3),
        defence: source.defence + Math.floor(progress / 5),
      };
    }),
  };
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
  const extraAct = chapter === 1 ? null : chapter as 2 | 3;
  const encounters = extraAct ? encounterRoles(extraAct, stage).map((roles, number) =>
    actEncounter(extraAct, stage, id, length, roles, number)) :
    FIRST_STAGE.encounters.map((source, number) => {
      const encounter = act1Encounter(source, index, number, id, length, false);
      if (stage >= 5 && number === 0) encounter.enemies.push({ ...encounter.enemies[0]! });
      return encounter;
    });
  const bossSource = extraAct ? actEnemies[extraAct].boss! : null;
  const boss = extraAct ? { id: `${id}-boss`, distance: length, enemies: [{ ...bossSource!,
    maxHp: Math.round(bossSource!.maxHp * (extraAct === 2 ? 1.2 : 1.15) * (1 + (stage - 1) * 0.10)),
    attack: bossSource!.attack + Math.floor((stage - 1) / 3),
    defence: bossSource!.defence + Math.floor((stage - 1) / 5),
  }] } : act1Encounter(FIRST_STAGE.boss, index, FIRST_STAGE.encounters.length, id, length, true);
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
