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
    assetPath: `${import.meta.env.BASE_URL}assets/pets/${name}/spritesheet.png`,
    portraitPath: `${import.meta.env.BASE_URL}assets/pets/${name}/portrait.png`,
    frameWidth: width, frameHeight: height, scale,
    originX: 0.5, originY: feetY / height, offsetY: 18,
    formationOffsetMetres: 40, attackDistanceMetres,
    frames: {
      idle: { start: 0, end: 11, fps: 8, repeat: -1 },
      run: { start: 12, end: 23, fps: 14, repeat: -1 },
      attack: { start: 24, end: 35, fps: 13, repeat: -1 },
      death: { start: 36, end: 47, fps: 12, repeat: 0 },
    },
  };
}

export const PET_VISUALS: Record<string, PetVisualConfig> = {
  pet_gold_v1: config("donkey", 157, 128, 0.57, 121, 36),
  pet_gems_v1: config("pug", 91, 77, 0.86, 73, 34),
  pet_gh_v1: config("watchdog", 142, 118, 0.62, 108, 38),
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
