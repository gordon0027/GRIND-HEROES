import Phaser from "phaser";
import { COMBAT_SKILLS, skillById, skillFor, type SkillId } from "../game/combatSkills";
import type { RuntimeHero } from "../game/stageRun";

/** Persistent indicators are drawn into one shared Graphics each frame. */
export function drawSkillStatus(g: Phaser.GameObjects.Graphics, hero: RuntimeHero,
  x: number, hpBarY: number, scale: number, time: number): void {
  const skill = skillFor(hero.classId);
  if (!skill || !hero.alive) return;
  const y = hpBarY + 12 * scale;
  const width = 24 * scale;
  const progress = Math.max(0, 1 - hero.skillCooldown / skill.cooldown);
  const ready = hero.skillCooldown <= 0;
  g.fillStyle(0x121928, 0.82).fillRoundedRect(x - width / 2 - 3, y - 4, width + 6, 8, 4);
  g.lineStyle(1, ready ? skill.vfx.color : 0x81919b, ready ? 0.9 : 0.55)
    .strokeRoundedRect(x - width / 2 - 3, y - 4, width + 6, 8, 4);
  g.fillStyle(skill.vfx.color, ready ? 0.85 + 0.15 * Math.sin(time / 180) : 0.65)
    .fillRoundedRect(x - width / 2, y - 2, Math.max(1, width * progress), 4, 2);
  if (hero.skillBuffRemaining > 0) {
    const pulse = 0.55 + 0.18 * Math.sin(time / 120);
    g.lineStyle(2 * scale, COMBAT_SKILLS.Archer.vfx.color, pulse)
      .strokeEllipse(x, hpBarY + 89 * scale, 48 * scale, 13 * scale);
    g.lineStyle(1, 0xcaff9a, pulse).strokeEllipse(x, hpBarY + 62 * scale, 30 * scale, 62 * scale);
  }
}

/** Short layered shapes use Phaser's existing feedback tween lifecycle. */
export function skillBurst(scene: Phaser.Scene, skillId: SkillId, x: number, y: number,
  impact: boolean, reducedMotion: boolean): { effect: Phaser.GameObjects.Graphics; duration: number; scale: number } {
  const g = scene.add.graphics({ x, y }).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
  const config = skillById(skillId);
  if (skillId === COMBAT_SKILLS.Knight.id) {
    if (impact) {
      g.fillStyle(0xffedac, 0.28).fillCircle(0, 0, 31);
      g.lineStyle(7, 0xffd367, 0.95).beginPath().arc(0, 0, 35, -1.2, 1.35).strokePath();
      g.lineStyle(2, 0xffffff, 0.92).beginPath().arc(0, 0, 28, -1.3, 1.3).strokePath();
      g.lineStyle(3, 0xffd367, 0.85).strokeEllipse(0, 42, 55, 12);
      g.fillStyle(0xffffff, 0.9).fillCircle(0, 0, 10);
      for (let i = 0; i < 5; i++) {
        const a = -1.1 + i * 0.62;
        g.lineStyle(2, 0xffefa1, 0.9).lineBetween(Math.cos(a) * 18, Math.sin(a) * 18,
          Math.cos(a) * 47, Math.sin(a) * 47);
      }
    } else {
      g.lineStyle(3, 0xffd367, 0.8).beginPath().arc(0, 0, 22, -1.5, 0.8).strokePath();
      g.fillStyle(0xffecaa, 0.5).fillCircle(10, -25, 5);
    }
  } else if (skillId === COMBAT_SKILLS.Archer.id) {
    g.fillStyle(0x75ff6f, 0.18).fillCircle(0, 0, 31);
    g.lineStyle(3, 0xa9ff85, 0.9).strokeEllipse(0, 24, 56, 15);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.lineStyle(2, i % 2 ? 0xd9ffc0 : 0x79ee72, 0.85)
        .lineBetween(Math.cos(a) * 12, Math.sin(a) * 12,
          Math.cos(a) * 35, Math.sin(a) * 35);
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
    g.fillStyle(0xff5b2c, 0.25).fillCircle(0, 0, 25);
    g.lineStyle(3, 0xffb658, 0.85).strokeCircle(0, 0, 19);
    g.fillStyle(0xfff5ae, 0.9).fillCircle(0, 0, 7);
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
