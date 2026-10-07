import type Phaser from "phaser";
import { ATTACK_TIMING } from "../game/combatTiming.ts";

export type HeroMotion = "idle" | "run" | "attack" | "death";

export interface HeroVisualConfig {
  textureKey: string;
  assetPath: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  originX: number;
  originY: number;
  offsetY: number;
  projectileOrigin: { x: number; y: number } | null;
  frames: Record<HeroMotion, { start: number; end: number; fps: number; repeat: number }>;
}

// The three supplied 3072x1024 PNGs share a 12-column, 4-row, 256px grid.
// Row 0: idle; row 1: run; row 2: attack; row 3: falling/death.
const frames: HeroVisualConfig["frames"] = {
  idle: { start: 0, end: 11, fps: 8, repeat: -1 },
  run: { start: 12, end: 23, fps: 15, repeat: -1 },
  attack: { start: 24, end: 35, fps: ATTACK_TIMING.hero.Knight.fps, repeat: 0 },
  death: { start: 36, end: 47, fps: 12, repeat: 0 },
};

function config(hero: string, offsetY = 0): HeroVisualConfig {
  return {
    textureKey: `grind-hero-${hero.toLowerCase()}`,
    assetPath: `${import.meta.env.BASE_URL}assets/heroes/${hero.toLowerCase()}/spritesheet.png`,
    frameWidth: 256,
    frameHeight: 256,
    scale: 0.84,
    // The standing feet are near source-frame y=188, hence 188/256.
    originX: 0.5,
    originY: 188 / 256,
    offsetY,
    // Source-frame offsets from the standing sprite origin, scaled with the hero.
    projectileOrigin: hero === "Archer" ? { x: 34, y: -40 }
      : hero === "Mage" ? { x: 68, y: -39 } : null,
    frames,
  };
}

export const HERO_VISUALS: Record<string, HeroVisualConfig> = {
  Knight: config("Knight"),
  Archer: config("Archer", 5),
  Mage: config("Mage", -6),
};

export function heroAnimationKey(heroID: string, motion: HeroMotion): string {
  return `grind-${heroID.toLowerCase()}-${motion}`;
}

export function registerHeroAnimations(scene: Phaser.Scene): void {
  for (const [heroID, visual] of Object.entries(HERO_VISUALS)) {
    for (const [motion, sequence] of Object.entries(visual.frames) as
      [HeroMotion, HeroVisualConfig["frames"][HeroMotion]][]) {
      const key = heroAnimationKey(heroID, motion);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(visual.textureKey,
          { start: sequence.start, end: sequence.end }),
        frameRate: sequence.fps,
        repeat: sequence.repeat,
      });
    }
  }
}
