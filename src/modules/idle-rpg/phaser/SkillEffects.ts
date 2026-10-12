import Phaser from "phaser";
import { COMBAT_SKILLS, skillById, type SkillId } from "../game/combatSkills";
import type { RuntimeHero } from "../game/stageRun";

/** Repainted in one Graphics object; no timers or per-frame particle objects. */
export function drawRapidFireAura(g: Phaser.GameObjects.Graphics, hero: RuntimeHero,
  x: number, groundY: number, scale: number, time: number): void {
  if (!hero.alive || hero.classId !== "Archer" || hero.skillBuffRemaining <= 0) return;
  const pulse = 0.72 + 0.15 * Math.sin(time / 125);
  g.fillStyle(0x51ee4a, 0.15 * pulse).fillEllipse(x, groundY - 52 * scale, 56 * scale, 92 * scale);
  g.lineStyle(3 * scale, 0x83ff6d, 0.9 * pulse)
    .strokeEllipse(x, groundY - 52 * scale, 53 * scale, 93 * scale);
  g.lineStyle(2 * scale, 0xc1ffae, 0.95 * pulse)
    .strokeEllipse(x, groundY - 5 * scale, 62 * scale, 14 * scale);
  for (let i = 0; i < 4; i++) {
    const rise = (time / 8 + i * 24) % 76;
    const side = i % 2 ? 22 : -22;
    g.fillStyle(0xb6ff92, 0.65 * pulse).fillCircle(x + side * scale,
      groundY - (13 + rise) * scale, 2 * scale);
  }
}

/** Short layered shapes use Phaser's existing feedback tween lifecycle. */
export function skillBurst(scene: Phaser.Scene, skillId: SkillId, x: number, y: number,
  impact: boolean, reducedMotion: boolean): { effect: Phaser.GameObjects.Graphics; duration: number; scale: number } {
  const g = scene.add.graphics({ x, y }).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
  const config = skillById(skillId);
  if (skillId === COMBAT_SKILLS.Knight.id) {
    if (impact) {
      g.fillStyle(0xffedac, 0.38).fillCircle(0, 0, 40);
      g.lineStyle(9, 0xffd367, 1).beginPath().arc(0, 0, 48, -1.3, 1.4).strokePath();
      g.lineStyle(3, 0xffffff, 1).beginPath().arc(0, 0, 39, -1.4, 1.35).strokePath();
      g.lineStyle(4, 0xffd367, 0.9).strokeEllipse(0, 44, 72, 15);
      g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, 15);
      for (let i = 0; i < 5; i++) {
        const a = -1.1 + i * 0.62;
        g.lineStyle(3, 0xffefa1, 0.9).lineBetween(Math.cos(a) * 23, Math.sin(a) * 23,
          Math.cos(a) * 60, Math.sin(a) * 60);
      }
    } else {
      g.lineStyle(4, 0xffd367, 0.9).beginPath().arc(0, 0, 30, -1.5, 0.8).strokePath();
      g.fillStyle(0xffecaa, 0.65).fillCircle(11, -31, 7);
    }
  } else if (skillId === COMBAT_SKILLS.Archer.id) {
    g.fillStyle(0x75ff6f, 0.25).fillCircle(0, 0, 42);
    g.lineStyle(4, 0xa9ff85, 1).strokeEllipse(0, 26, 67, 19);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.lineStyle(3, i % 2 ? 0xd9ffc0 : 0x79ee72, 0.95)
        .lineBetween(Math.cos(a) * 15, Math.sin(a) * 15,
          Math.cos(a) * 46, Math.sin(a) * 46);
    }
  } else if (impact) {
    g.fillStyle(0xff4a1c, 0.25).fillCircle(0, 0, 54);
    g.fillStyle(0xffae38, 0.36).fillCircle(0, 0, 35);
    g.fillStyle(0xfff1a8, 0.78).fillCircle(0, 0, 13);
    g.lineStyle(5, 0xff8b3c, 0.95).strokeCircle(0, 0, 48);
    g.lineStyle(2, 0xffe0a1, 0.85).strokeCircle(0, 0, 61);
    g.lineStyle(3, 0xff793a, 0.75).strokeEllipse(0, 46, 90, 18);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const r = i % 2 ? 68 : 57;
      g.fillStyle(i % 3 ? 0xffb348 : 0xffe09b, 0.9)
        .fillCircle(Math.cos(a) * r, Math.sin(a) * r, i % 2 ? 2 : 3);
    }
  } else {
    g.fillStyle(0xff5b2c, 0.35).fillCircle(0, 0, 30);
    g.lineStyle(4, 0xffb658, 0.95).strokeCircle(0, 0, 24);
    g.fillStyle(0xfff5ae, 1).fillCircle(0, 0, 10);
  }
  if (impact) g.lineStyle(1, config.vfx.color, 0.55)
    .strokeCircle(0, 0, config.vfx.impactRadius);
  return { effect: g, duration: reducedMotion ? 95 : impact ? 300 : config.vfx.anticipationMs,
    scale: impact ? 1.55 : 1.25 };
}

export function meteorGroundFire(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y }).setDepth(3.8).setBlendMode(Phaser.BlendModes.ADD);
  g.fillStyle(0xff5721, 0.22).fillEllipse(0, 0, 96, 19);
  g.lineStyle(2, 0xffa749, 0.72).strokeEllipse(0, 0, 87, 15);
  for (let i = 0; i < 5; i++) {
    const px = (i - 2) * 17;
    g.fillStyle(i % 2 ? 0xffd66f : 0xff8b32, 0.7)
      .fillTriangle(px - 5, 0, px + 5, 0, px + (i % 2 ? 2 : -2), -13 - i % 3 * 4);
  }
  return g;
}
