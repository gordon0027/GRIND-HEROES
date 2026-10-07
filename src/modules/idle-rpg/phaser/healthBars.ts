import type Phaser from "phaser";

/** Compact metal-rimmed bars shared by the live stage and legacy battle scene. */
export function drawHealthBar(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number, top: number, width: number, share: number,
  kind: "hero" | "enemy" | "boss",
): void {
  const height = kind === "boss" ? 13 : kind === "hero" ? 9 : 8;
  const x = centerX - width / 2;
  const amount = Math.max(0, Math.min(1, share));
  const rim = kind === "boss" ? 0xb89a69 : 0x8b795f;
  const fill = kind === "hero" ? 0x59c878 : kind === "boss" ? 0xd94b4d : 0xd99058;
  const shadow = kind === "hero" ? 0x285c3c : kind === "boss" ? 0x762c36 : 0x764a2e;
  graphics.fillStyle(0x0e0d0e, 0.9).fillRoundedRect(x - 2, top - 2, width + 4, height + 4, 3);
  graphics.lineStyle(kind === "boss" ? 2 : 1, rim, 1)
    .strokeRoundedRect(x - 1, top - 1, width + 2, height + 2, 3);
  graphics.fillStyle(0x241c1b, 1).fillRoundedRect(x, top, width, height, 2);
  if (amount > 0) {
    const filled = Math.max(2, (width - 2) * amount);
    graphics.fillStyle(shadow, 1).fillRoundedRect(x + 1, top + 1, filled, height - 2, 2);
    graphics.fillStyle(fill, 1).fillRoundedRect(x + 1, top + 1, filled, Math.max(2, (height - 2) * 0.65), 2);
    graphics.fillStyle(0xffffff, 0.23).fillRect(x + 3, top + 2, Math.max(0, filled - 5), 1);
  }
  if (kind === "boss") {
    graphics.fillStyle(0xe2bf7d, 1).fillRect(x - 4, top + 2, 3, height - 4);
    graphics.fillRect(x + width + 1, top + 2, 3, height - 4);
  }
}
