import Phaser from "phaser";
import type { MonsterKind } from "../game/stages";

// All the art is drawn here in code and baked into textures once (Graphics → generateTexture): the
// module ships no image files, so it builds offline and runs in the preview as is. Cute and chunky,
// thick dark outlines — the Legend Slime look.

const OUTLINE = 0x2b1d33;

export const HERO_SIZE = { w: 120, h: 112 };
export const MONSTER_SIZE = 96;

type G = Phaser.GameObjects.Graphics;

function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: G) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

/** A darker / lighter shade of a colour. */
export function shade(color: number, k: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) =>
    Math.max(
      0,
      Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)),
    );
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

function eyes(
  g: G,
  cx: number,
  cy: number,
  gap: number,
  r: number,
  angry = false,
): void {
  for (const dx of [-gap, gap]) {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + dx, cy, r);
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx + dx + r * 0.2, cy + r * 0.15, r * 0.55);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx + dx + r * 0.4, cy - r * 0.2, r * 0.2);
  }
  if (angry) {
    g.lineStyle(3, OUTLINE, 1);
    g.lineBetween(cx - gap - r, cy - r * 1.4, cx - gap + r, cy - r * 0.8);
    g.lineBetween(cx + gap + r, cy - r * 1.4, cx + gap - r, cy - r * 0.8);
  }
}

// ── The hero: a slime with the hat of its class ──────────────────────────────────────────────

export const CLASS_COLORS: Record<string, number> = {
  Warrior: 0x4fa8ff,
  Ranger: 0x5fd36a,
  Mage: 0xb36bff,
};

export function heroColor(classID: string, heroID: string): number {
  const known = CLASS_COLORS[classID];
  if (known) return known;
  let h = 0;
  for (const ch of heroID) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Phaser.Display.Color.HSVToRGB((h % 360) / 360, 0.55, 0.95).color;
}

export function heroTexture(
  scene: Phaser.Scene,
  classID: string,
  heroID: string,
): string {
  const color = heroColor(classID, heroID);
  const hat =
    classID === "Mage"
      ? "wizard"
      : classID === "Ranger"
        ? "hood"
        : classID === "Warrior"
          ? "helmet"
          : "none";
  const { w, h } = HERO_SIZE;
  return bake(scene, `hero-${color.toString(16)}-${hat}`, w, h, (g) => {
    const cx = w / 2;
    const base = h - 6;
    // Shadow-outline, body, belly highlight, shine.
    g.fillStyle(OUTLINE, 1);
    g.fillEllipse(cx, base - 30, 96, 66);
    g.fillStyle(shade(color, -0.25), 1);
    g.fillEllipse(cx, base - 30, 90, 60);
    g.fillStyle(color, 1);
    g.fillEllipse(cx, base - 33, 86, 52);
    g.fillStyle(shade(color, 0.45), 1);
    g.fillEllipse(cx - 18, base - 46, 26, 14);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 24, base - 49, 4);
    eyes(g, cx + 6, base - 34, 13, 7);
    g.fillStyle(0xff7a9a, 0.6);
    g.fillEllipse(cx - 14, base - 22, 10, 5);
    g.fillEllipse(cx + 28, base - 22, 10, 5);
    g.lineStyle(3, OUTLINE, 1);
    g.beginPath();
    g.arc(cx + 7, base - 24, 5, 0.2, Math.PI - 0.2);
    g.strokePath();
    // Hat.
    if (hat === "wizard") {
      g.fillStyle(OUTLINE, 1);
      g.fillTriangle(
        cx - 30,
        base - 52,
        cx + 30,
        base - 52,
        cx + 8,
        base - 108,
      );
      g.fillStyle(0x6a3fd0, 1);
      g.fillTriangle(
        cx - 26,
        base - 55,
        cx + 26,
        base - 55,
        cx + 8,
        base - 103,
      );
      g.fillStyle(0xffd34d, 1);
      g.fillCircle(cx + 4, base - 72, 5);
      g.fillStyle(0x6a3fd0, 1);
      g.fillEllipse(cx, base - 54, 70, 12);
    } else if (hat === "hood") {
      g.fillStyle(OUTLINE, 1);
      g.fillTriangle(
        cx - 34,
        base - 46,
        cx + 34,
        base - 46,
        cx - 20,
        base - 92,
      );
      g.fillStyle(0x2f8a3a, 1);
      g.fillTriangle(
        cx - 30,
        base - 49,
        cx + 30,
        base - 49,
        cx - 18,
        base - 87,
      );
      g.fillStyle(0xd94040, 1);
      g.fillTriangle(cx - 14, base - 74, cx - 4, base - 66, cx + 8, base - 92);
    } else if (hat === "helmet") {
      g.fillStyle(OUTLINE, 1);
      g.fillEllipse(cx, base - 56, 70, 40);
      g.fillStyle(0xb8c2d1, 1);
      g.fillEllipse(cx, base - 57, 64, 34);
      g.fillStyle(0xe6ecf5, 1);
      g.fillEllipse(cx - 10, base - 64, 22, 10);
      g.fillStyle(0xd94040, 1);
      g.fillRect(cx - 3, base - 90, 6, 18);
      g.fillCircle(cx, base - 90, 6);
    }
  });
}

// ── Monsters ─────────────────────────────────────────────────────────────────────────────────

export function monsterTexture(scene: Phaser.Scene, kind: MonsterKind): string {
  const s = MONSTER_SIZE;
  return bake(scene, `monster-${kind}`, s, s, (g) => {
    const cx = s / 2;
    const base = s - 6;
    switch (kind) {
      case "mushroom":
        g.fillStyle(OUTLINE, 1);
        g.fillRoundedRect(cx - 18, base - 38, 36, 38, 12);
        g.fillStyle(0xf3dfbf, 1);
        g.fillRoundedRect(cx - 15, base - 36, 30, 34, 10);
        g.fillStyle(OUTLINE, 1);
        g.fillEllipse(cx, base - 46, 78, 50);
        g.fillStyle(0xe2453c, 1);
        g.fillEllipse(cx, base - 47, 72, 44);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx - 18, base - 54, 7);
        g.fillCircle(cx + 14, base - 60, 5);
        g.fillCircle(cx + 22, base - 44, 4);
        eyes(g, cx - 4, base - 22, 8, 5, true);
        break;
      case "bat":
        g.fillStyle(OUTLINE, 1);
        g.fillTriangle(
          cx - 46,
          base - 58,
          cx - 8,
          base - 50,
          cx - 14,
          base - 30,
        );
        g.fillTriangle(
          cx + 46,
          base - 58,
          cx + 8,
          base - 50,
          cx + 14,
          base - 30,
        );
        g.fillStyle(0x6c3f8f, 1);
        g.fillTriangle(
          cx - 41,
          base - 56,
          cx - 10,
          base - 49,
          cx - 15,
          base - 34,
        );
        g.fillTriangle(
          cx + 41,
          base - 56,
          cx + 10,
          base - 49,
          cx + 15,
          base - 34,
        );
        g.fillStyle(OUTLINE, 1);
        g.fillCircle(cx, base - 44, 22);
        g.fillStyle(0x8e5bb8, 1);
        g.fillCircle(cx, base - 44, 19);
        eyes(g, cx - 2, base - 46, 8, 5, true);
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(cx - 6, base - 32, cx - 2, base - 32, cx - 4, base - 26);
        g.fillTriangle(cx + 2, base - 32, cx + 6, base - 32, cx + 4, base - 26);
        break;
      case "goblin":
        g.fillStyle(OUTLINE, 1);
        g.fillTriangle(
          cx - 44,
          base - 52,
          cx - 18,
          base - 44,
          cx - 22,
          base - 30,
        );
        g.fillTriangle(
          cx + 44,
          base - 52,
          cx + 18,
          base - 44,
          cx + 22,
          base - 30,
        );
        g.fillEllipse(cx, base - 30, 64, 58);
        g.fillStyle(0x6cc04a, 1);
        g.fillTriangle(
          cx - 40,
          base - 50,
          cx - 19,
          base - 43,
          cx - 22,
          base - 33,
        );
        g.fillTriangle(
          cx + 40,
          base - 50,
          cx + 19,
          base - 43,
          cx + 22,
          base - 33,
        );
        g.fillEllipse(cx, base - 30, 58, 52);
        g.fillStyle(shade(0x6cc04a, 0.35), 1);
        g.fillEllipse(cx - 10, base - 44, 18, 9);
        eyes(g, cx - 3, base - 34, 10, 6, true);
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(cx - 2, base - 18, cx + 6, base - 18, cx + 2, base - 11);
        break;
      case "skull":
        g.fillStyle(OUTLINE, 1);
        g.fillCircle(cx, base - 40, 30);
        g.fillRoundedRect(cx - 18, base - 22, 36, 22, 6);
        g.fillStyle(0xf1ece0, 1);
        g.fillCircle(cx, base - 40, 26);
        g.fillRoundedRect(cx - 15, base - 22, 30, 19, 5);
        g.fillStyle(OUTLINE, 1);
        g.fillEllipse(cx - 11, base - 40, 14, 16);
        g.fillEllipse(cx + 11, base - 40, 14, 16);
        g.fillTriangle(cx - 4, base - 26, cx + 4, base - 26, cx, base - 32);
        g.fillStyle(0xff4d4d, 1);
        g.fillCircle(cx - 11, base - 40, 3);
        g.fillCircle(cx + 11, base - 40, 3);
        break;
      case "golem":
        g.fillStyle(OUTLINE, 1);
        g.fillRoundedRect(cx - 36, base - 66, 72, 66, 18);
        g.fillStyle(0x8a8f9c, 1);
        g.fillRoundedRect(cx - 32, base - 62, 64, 60, 15);
        g.fillStyle(shade(0x8a8f9c, 0.3), 1);
        g.fillRoundedRect(cx - 26, base - 58, 26, 14, 6);
        g.lineStyle(3, shade(0x8a8f9c, -0.4), 1);
        g.lineBetween(cx + 6, base - 60, cx + 14, base - 46);
        g.lineBetween(cx + 14, base - 46, cx + 8, base - 34);
        g.fillStyle(0x7fe0ff, 1);
        g.fillRect(cx - 18, base - 38, 12, 6);
        g.fillRect(cx + 4, base - 38, 12, 6);
        break;
      case "cactus":
        g.fillStyle(OUTLINE, 1);
        g.fillRoundedRect(cx - 18, base - 70, 36, 70, 18);
        g.fillRoundedRect(cx - 40, base - 52, 20, 30, 10);
        g.fillRoundedRect(cx + 20, base - 60, 20, 30, 10);
        g.fillStyle(0x47a85a, 1);
        g.fillRoundedRect(cx - 15, base - 67, 30, 64, 15);
        g.fillRoundedRect(cx - 37, base - 49, 14, 24, 7);
        g.fillRoundedRect(cx + 23, base - 57, 14, 24, 7);
        g.fillStyle(0xff7aa8, 1);
        g.fillCircle(cx + 6, base - 68, 6);
        eyes(g, cx, base - 44, 7, 5, true);
        break;
      case "yeti":
        g.fillStyle(OUTLINE, 1);
        g.fillEllipse(cx, base - 34, 76, 66);
        g.fillStyle(0xf4f8ff, 1);
        g.fillEllipse(cx, base - 34, 70, 60);
        g.fillStyle(0x7fa8d6, 1);
        g.fillEllipse(cx, base - 32, 40, 30);
        eyes(g, cx, base - 36, 9, 5, true);
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(cx - 8, base - 22, cx - 2, base - 22, cx - 5, base - 15);
        g.fillTriangle(cx + 2, base - 22, cx + 8, base - 22, cx + 5, base - 15);
        break;
      case "imp":
      default:
        g.fillStyle(OUTLINE, 1);
        g.fillTriangle(
          cx - 26,
          base - 50,
          cx - 10,
          base - 58,
          cx - 28,
          base - 78,
        );
        g.fillTriangle(
          cx + 26,
          base - 50,
          cx + 10,
          base - 58,
          cx + 28,
          base - 78,
        );
        g.fillCircle(cx, base - 34, 30);
        g.fillStyle(0xe8483a, 1);
        g.fillCircle(cx, base - 34, 26);
        g.fillStyle(0xffd34d, 1);
        g.fillTriangle(
          cx - 23,
          base - 53,
          cx - 12,
          base - 57,
          cx - 25,
          base - 73,
        );
        g.fillTriangle(
          cx + 23,
          base - 53,
          cx + 12,
          base - 57,
          cx + 25,
          base - 73,
        );
        eyes(g, cx, base - 36, 10, 6, true);
        g.lineStyle(3, OUTLINE, 1);
        g.lineBetween(cx - 8, base - 20, cx + 8, base - 20);
        break;
    }
  });
}

// ── Small things ─────────────────────────────────────────────────────────────────────────────

export function bakeCommon(scene: Phaser.Scene): void {
  bake(scene, "coin", 26, 26, (g) => {
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(13, 13, 12);
    g.fillStyle(0xf2a516, 1);
    g.fillCircle(13, 13, 10);
    g.fillStyle(0xffd34d, 1);
    g.fillCircle(13, 13, 7);
    g.fillStyle(0xfff3b0, 1);
    g.fillCircle(10, 10, 2.5);
  });
  bake(scene, "spark", 16, 16, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 4);
  });
  bake(scene, "puff", 32, 32, (g) => {
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(16, 16, 14);
  });
  bake(scene, "cloud", 170, 70, (g) => {
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(40, 44, 24);
    g.fillCircle(72, 32, 30);
    g.fillCircle(108, 38, 26);
    g.fillCircle(136, 48, 20);
    g.fillRoundedRect(30, 44, 120, 24, 12);
  });
  bake(scene, "meteor", 48, 48, (g) => {
    g.fillStyle(0xff7a1a, 0.4);
    g.fillCircle(24, 24, 22);
    g.fillStyle(0xffb03a, 1);
    g.fillCircle(24, 24, 14);
    g.fillStyle(0xfff0a0, 1);
    g.fillCircle(20, 20, 6);
  });
}

/** The hero's shot: an orb in the hero's colour. */
export function shotTexture(scene: Phaser.Scene, color: number): string {
  return bake(scene, `shot-${color.toString(16)}`, 28, 28, (g) => {
    g.fillStyle(color, 0.35);
    g.fillCircle(14, 14, 13);
    g.fillStyle(shade(color, 0.3), 1);
    g.fillCircle(14, 14, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 12, 3.5);
  });
}
