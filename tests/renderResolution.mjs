import assert from 'node:assert/strict';
import { battleRenderSize, sameBattleRenderSize } from '../src/modules/idle-rpg/game/renderResolution.ts';

const mobile = battleRenderSize(390, 794, 3);
assert.deepEqual([mobile.cssWidth, mobile.cssHeight], [390, 794]);
assert.deepEqual([mobile.backingWidth, mobile.backingHeight], [780, 1588]);
assert.equal(mobile.effectiveDpr, 2);
assert.deepEqual([mobile.scaleX, mobile.scaleY], [2, 2]);

const desktop = battleRenderSize(1920, 1032, 1);
assert.deepEqual([desktop.backingWidth, desktop.backingHeight], [1920, 1032]);
assert.equal(desktop.effectiveDpr, 1);

const desktopHiDpi = battleRenderSize(1920, 1032, 2);
assert.deepEqual([desktopHiDpi.backingWidth, desktopHiDpi.backingHeight], [3840, 2064]);
assert.ok(desktopHiDpi.backingWidth * desktopHiDpi.backingHeight <= 3840 * 2160);

const rotated = battleRenderSize(794, 390, 3);
assert.deepEqual([rotated.backingWidth, rotated.backingHeight], [1588, 780]);
assert.equal(sameBattleRenderSize(mobile, battleRenderSize(390, 794, 3)), true);
assert.equal(sameBattleRenderSize(mobile, rotated), false);
assert.equal(sameBattleRenderSize(mobile, battleRenderSize(391, 794, 3)), false);
assert.deepEqual([battleRenderSize(390, 794, NaN).scaleX,
  battleRenderSize(390, 794, NaN).scaleY], [1, 1]);

console.log('Battle render resolution tests passed');
