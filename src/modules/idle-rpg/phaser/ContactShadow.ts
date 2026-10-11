import type Phaser from "phaser";

const TEXTURE = "grind-contact-shadow";

/** One tiny shared texture, no filters, no per-frame Graphics allocation. */
export class ContactShadow {
  private image: Phaser.GameObjects.Image;
  private dying = false;

  constructor(private readonly scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) {
      const paint = scene.add.graphics();
      for (let ring = 10; ring >= 1; ring--) {
        paint.fillStyle(0x10131c, 0.05);
        paint.fillEllipse(32, 12, 64 * ring / 10, 24 * ring / 10);
      }
      paint.generateTexture(TEXTURE, 64, 24);
      paint.destroy();
    }
    this.image = scene.add.image(0, 0, TEXTURE).setDepth(2);
  }

  follow(x: number, feetY: number, width: number): void {
    this.image.setPosition(x, feetY + 1).setDisplaySize(width, width * 0.25);
  }

  fade(): void {
    if (this.dying) return;
    this.dying = true;
    this.scene.tweens.add({ targets: this.image, alpha: 0, duration: 400 });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.image);
    this.image.destroy();
  }
}
