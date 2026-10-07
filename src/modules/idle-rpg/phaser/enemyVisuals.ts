import type Phaser from "phaser";
import { ATTACK_TIMING } from "../game/combatTiming.ts";

export type EnemyMotion = "idle" | "run" | "attack" | "death";
export type EnemyVisualID = "goblin1" | "goblin2" | "goblinboss" | "ogreboss" |
  "orange1" | "orangeFat" | "orangeArcher" | "orangeHeavy" | "orangeOgre" |
  "undead1" | "undeadArcher" | "undeadHeavy" | "zombieOgre";

export interface EnemyVisualConfig {
  textureKey: string;
  assetPath: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  originX: number;
  originY: number;
  offsetY: number;
  contactOffsetPx: number;
  frames: Record<EnemyMotion, { start: number; end: number; fps: number; repeat: number }>;
}

// All sheets have 12 columns × 4 rows: idle, move, attack, death.
// Goblins have 256px frames; the ogre has 300×260px frames. No hit row.
const frames: EnemyVisualConfig["frames"] = {
  idle: { start: 0, end: 11, fps: 8, repeat: -1 },
  run: { start: 12, end: 23, fps: 14, repeat: -1 },
  attack: { start: 24, end: 35, fps: ATTACK_TIMING.enemy.normal.fps, repeat: 0 },
  death: { start: 36, end: 47, fps: 16, repeat: 0 },
};

function visual(id: EnemyVisualID, folder: string, filename: string, scale: number,
  frameWidth: number, frameHeight: number, feetY: number,
  contactOffsetPx: number): EnemyVisualConfig {
  return {
    textureKey: `grind-enemy-${id}`,
    assetPath: `${import.meta.env?.BASE_URL ?? "/"}assets/enemies/${folder}/${filename}`,
    frameWidth, frameHeight, scale,
    originX: 0.5, originY: feetY / frameHeight, offsetY: 0,
    contactOffsetPx, frames,
  };
}

export const ENEMY_VISUALS: Record<EnemyVisualID, EnemyVisualConfig> = {
  goblin1: visual("goblin1", "goblin1", "Goblin1.png", 0.9, 256, 256, 183, 7),
  goblin2: visual("goblin2", "goblin2", "Goblin2.png", 0.95, 256, 256, 190, 7),
  goblinboss: visual("goblinboss", "goblin3", "GoblinBoss.png", 1.0, 256, 256, 194, 10),
  ogreboss: visual("ogreboss", "ogreboss", "ogreboss.png", 1.0, 300, 260, 234, 20),
  orange1: visual("orange1", "act2", "GoblinOrange_1.png", 0.9, 256, 256, 183, 7),
  orangeFat: visual("orangeFat", "act2", "GoblinOrange_2_Fat.png", 0.95, 256, 256, 190, 9),
  orangeArcher: visual("orangeArcher", "act2", "GoblinOrange_Archer_4.png", 0.9, 256, 256, 185, 7),
  orangeHeavy: visual("orangeHeavy", "act2", "GoblinOrange_Heavy_3.png", 1, 256, 256, 194, 10),
  orangeOgre: visual("orangeOgre", "act2", "OrangeOgre.png", 1, 314, 261, 234, 20),
  undead1: visual("undead1", "act3", "Undead_1_Simple.png", 0.9, 256, 256, 185, 7),
  undeadArcher: visual("undeadArcher", "act3", "Undead_2_Archer.png", 0.9, 256, 256, 185, 7),
  undeadHeavy: visual("undeadHeavy", "act3", "Undead_3_Heavy.png", 1, 256, 256, 195, 10),
  zombieOgre: visual("zombieOgre", "act3", "ZombieOgre.png", 1, 314, 260, 234, 20),
};

export function enemyAnimationKey(id: EnemyVisualID, motion: EnemyMotion): string {
  return `grind-${id}-${motion}`;
}

export function registerEnemyAnimations(scene: Phaser.Scene): void {
  for (const [id, config] of Object.entries(ENEMY_VISUALS) as [EnemyVisualID, EnemyVisualConfig][]) {
    for (const [motion, sequence] of Object.entries(config.frames) as
      [EnemyMotion, EnemyVisualConfig["frames"][EnemyMotion]][]) {
      const key = enemyAnimationKey(id, motion);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(config.textureKey,
          { start: sequence.start, end: sequence.end }),
        frameRate: sequence.fps,
        repeat: sequence.repeat,
      });
    }
  }
}
