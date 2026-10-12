import { COMBAT_SKILLS, type SkillId } from "./combatSkills.ts";
import type { ProjectileType } from "./stageRun.ts";

export interface HitProfile {
  heavy: boolean;
  color: number;
  flashMs: number;
  recoilPx: number;
  recoilMs: number;
  holdMs: number;
}

/** Presentation policy only: it never changes damage, coordinates or simulation time. */
export function hitProfile(source: "MELEE" | ProjectileType, skillId: SkillId | undefined,
  boss: boolean): HitProfile {
  const heavy = skillId === COMBAT_SKILLS.Knight.id || source === "METEOR_FIREBALL";
  return { heavy, color: source === "METEOR_FIREBALL" ? 0xffa34c :
    source === "MAGIC_ORB" ? 0xff8b71 : heavy ? 0xffdc79 : 0xffedd0,
    flashMs: heavy ? (boss ? 145 : 115) : 80,
    recoilPx: boss ? 0 : heavy ? 10 : 3,
    recoilMs: heavy ? 175 : 100,
    holdMs: skillId === COMBAT_SKILLS.Knight.id ? 55 : source === "METEOR_FIREBALL" ? 50 : 0 };
}

/** A quick kick followed by a smooth return; simultaneous hits never add displacement. */
export function visualRecoil(ageMs: number, profile: HitProfile): number {
  if (ageMs < 0 || ageMs >= profile.recoilMs) return 0;
  const t = ageMs / profile.recoilMs;
  return profile.recoilPx * (1 - t) * (1 - t);
}

export class FeedbackThrottle {
  private nextAt = -Infinity;
  take(now: number, spacingMs: number): boolean {
    if (now < this.nextAt) return false;
    this.nextAt = now + spacingMs;
    return true;
  }
  reset(): void { this.nextAt = -Infinity; }
}

/** Attack-row emphasis for decorative pets; no separate pet damage is implied. */
export function petAttackLunge(frame: number): number {
  return frame >= 26 && frame <= 31 ? Math.sin((frame - 26) / 5 * Math.PI) * 4 : 0;
}
