/** Keep battle coordinates in CSS pixels while allocating enough physical pixels for Phaser. */
export interface BattleRenderSize {
  cssWidth: number;
  cssHeight: number;
  backingWidth: number;
  backingHeight: number;
  scaleX: number;
  scaleY: number;
  effectiveDpr: number;
}

const MAX_DPR = 2;
// A 3840 × 2160 surface uses about 32 MiB before WebGL's additional buffers.
const MAX_BACKING_PIXELS = 3840 * 2160;

export function battleRenderSize(width: number, height: number, deviceDpr: number): BattleRenderSize {
  const cssWidth = Math.max(1, Math.round(width));
  const cssHeight = Math.max(1, Math.round(height));
  const nativeDpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  const areaCap = Math.sqrt(MAX_BACKING_PIXELS / (cssWidth * cssHeight));
  const effectiveDpr = Math.max(1, Math.min(nativeDpr, MAX_DPR, areaCap));
  const backingWidth = Math.max(1, Math.round(cssWidth * effectiveDpr));
  const backingHeight = Math.max(1, Math.round(cssHeight * effectiveDpr));
  return {
    cssWidth, cssHeight, backingWidth, backingHeight, effectiveDpr,
    scaleX: backingWidth / cssWidth,
    scaleY: backingHeight / cssHeight,
  };
}

export function sameBattleRenderSize(a: BattleRenderSize, b: BattleRenderSize): boolean {
  return a.cssWidth === b.cssWidth && a.cssHeight === b.cssHeight &&
    a.backingWidth === b.backingWidth && a.backingHeight === b.backingHeight;
}
