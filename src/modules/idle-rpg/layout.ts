// One screen split in two: the fight on top (Phaser draws it on the full-bleed canvas) and the
// Enhance panel below (React). Both sides compute the split from the SAME numbers — the canvas draws
// the field into the top part, the panel starts right under it.

/** The fight takes this share of the screen height… */
export const BATTLE_SHARE = 0.44;
/** …but never more than this many pixels (a tall desktop window gets a bigger panel, not a stretched field). */
export const BATTLE_MAX_PX = 430;
/** The lane is at most this wide; a wider screen centres it. */
export const LANE_MAX_PX = 980;

export function battleHeight(screenHeight: number): number {
  return Math.round(Math.min(screenHeight * BATTLE_SHARE, BATTLE_MAX_PX));
}

/** The same split as a CSS length, for the React side. */
export const BATTLE_HEIGHT_CSS = `min(${BATTLE_SHARE * 100}%, ${BATTLE_MAX_PX}px)`;
