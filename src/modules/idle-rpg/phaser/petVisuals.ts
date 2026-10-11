import type Phaser from "phaser";

export type PetMotion = "idle" | "run" | "attack" | "death";

export interface PetVisualConfig {
  textureKey: string;
  assetPath: string;
  portraitPath: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  originX: number;
  originY: number;
  feetByFrame: readonly number[];
  offsetY: number;
  formationOffsetMetres: number;
  attackDistanceMetres: number;
  frames: Record<PetMotion, { start: number; end: number; fps: number; repeat: number }>;
}

// The supplied sheets each have twelve nonempty frames per row. Their individual
// frame sizes differ; rows are idle, run, attack, then falling/defeat.
function config(name: string, width: number, height: number, scale: number,
  feetY: number, attackDistanceMetres: number): PetVisualConfig {
  return {
    textureKey: `grind-pet-${name}`,
    assetPath: `${(import.meta.env?.BASE_URL ?? "/")}assets/pets/${name}/spritesheet.png`,
    portraitPath: `${(import.meta.env?.BASE_URL ?? "/")}assets/pets/${name}/portrait.png`,
    frameWidth: width, frameHeight: height, scale,
    originX: 0.5, originY: feetY / height, offsetY: 12,
    feetByFrame: PET_FEET[name]!,
    formationOffsetMetres: 40, attackDistanceMetres,
    frames: {
      idle: { start: 0, end: 11, fps: 8, repeat: -1 },
      run: { start: 12, end: 23, fps: 14, repeat: -1 },
      attack: { start: 24, end: 35, fps: 13, repeat: -1 },
      death: { start: 36, end: 47, fps: 12, repeat: 0 },
    },
  };
}

// Alpha-audited foot/body contact, not frame center. The rolling Pug death row
// needs its own anchors; weapon pixels are absent from these quadruped sheets.
const PET_FEET: Record<string, readonly number[]> = {
  donkey: [125,125,125,125,125,125,125,125,125,125,125,125,
    125,125,125,125,125,125,126,125,125,125,125,125,
    125,125,125,125,125,124,125,126,126,124,125,126,
    125,125,126,126,127,128,128,128,127,126,126,126],
  pug: [75,75,75,75,75,75,75,75,75,75,75,75,
    75,75,75,75,75,75,75,75,75,75,75,75,
    75,75,75,75,75,75,75,76,77,76,76,75,
    75,71,62,55,54,60,70,75,74,68,72,76],
  watchdog: [107,107,107,107,107,107,107,107,107,107,107,107,
    107,107,107,107,107,107,107,107,107,107,107,107,
    107,107,108,109,112,108,109,109,109,109,108,108,
    107,107,107,108,108,108,108,108,111,111,111,118],
};

export const PET_VISUALS: Record<string, PetVisualConfig> = {
  pet_gold_v1: config("donkey", 157, 128, 0.52, 125, 36),
  pet_gems_v1: config("pug", 91, 77, 0.65, 75, 34),
  pet_gh_v1: config("watchdog", 142, 118, 0.58, 107, 38),
};

export function petAnimationKey(id: string, motion: PetMotion): string {
  return `grind-${id}-${motion}`;
}

export function registerPetAnimations(scene: Phaser.Scene): void {
  for (const [id, visual] of Object.entries(PET_VISUALS)) {
    for (const motion of ["idle", "run", "attack", "death"] as const) {
      const sequence = visual.frames[motion];
      const key = petAnimationKey(id, motion);
      if (scene.anims.exists(key) || !scene.textures.exists(visual.textureKey)) continue;
      scene.anims.create({ key,
        frames: scene.anims.generateFrameNumbers(visual.textureKey,
          { start: sequence.start, end: sequence.end }),
        frameRate: sequence.fps, repeat: sequence.repeat });
    }
  }
}
