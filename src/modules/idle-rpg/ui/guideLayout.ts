export interface GuideRect { x: number; y: number; width: number; height: number }

/** All coordinates are relative to this game's iframe viewport. */
export function guidePanelPosition(view: { width: number; height: number }, height: number,
  target: GuideRect | null): GuideRect {
  const width = Math.min(400, view.width - 24);
  const centeredX = Math.max(12, Math.min(view.width - width - 12,
    target ? target.x + target.width / 2 - width / 2 : (view.width - width) / 2));
  if (!target) return { x: centeredX, y: Math.max(12, (view.height - height) / 2), width, height };
  const above = target.y - 16 - height;
  const below = target.y + target.height + 16;
  if (above < 12 && below + height > view.height - 12) {
    if (target.x >= width + 28) return { x: target.x - width - 16,
      y: Math.max(12, Math.min(view.height - height - 12, target.y)), width, height };
    if (view.width - target.x - target.width >= width + 28) return {
      x: target.x + target.width + 16,
      y: Math.max(12, Math.min(view.height - height - 12, target.y)), width, height };
  }
  const y = above >= 12 ? above : below + height <= view.height - 12 ? below : 12;
  return { x: centeredX, y, width, height };
}

export function overlaps(a: GuideRect, b: GuideRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}
