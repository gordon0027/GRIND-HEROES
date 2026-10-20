import assert from "node:assert/strict";
import { onboardingStep, restoreGuide } from "../src/modules/idle-rpg/game/onboarding.ts";
import { guidePanelPosition, overlaps } from "../src/modules/idle-rpg/ui/guideLayout.ts";

const fresh = { active: true, welcomed: true, victorySeen: true, firstClear: false, capacity: 1,
  archerOwned: false, archerAssigned: false };
assert.equal(onboardingStep(fresh), "battle");
assert.equal(onboardingStep({ ...fresh, welcomed: false }), "welcome");
assert.equal(onboardingStep({ ...fresh, firstClear: true, victorySeen: false }), "victory");
assert.equal(onboardingStep({ ...fresh, firstClear: true }), "slot");
assert.equal(onboardingStep({ ...fresh, firstClear: true, capacity: 2 }), "recruit");
assert.equal(onboardingStep({ ...fresh, firstClear: true, capacity: 2, archerOwned: true }), "assign");
assert.equal(onboardingStep({ ...fresh, firstClear: true, capacity: 2, archerOwned: true,
  archerAssigned: true }), "complete");
assert.equal(onboardingStep({ ...fresh, active: false }), null);
assert.equal(restoreGuide(null, true).status, "done", "existing players are excluded");
assert.equal(restoreGuide(null, false).welcomed, false);
assert.equal(restoreGuide("active", true).victorySeen, true, "legacy active saves migrate");
for (const status of ["active", "skipped", "done"]) {
  const saved = { status, welcomed: true, victorySeen: true, rewardGold: 11100 };
  assert.deepEqual(restoreGuide(JSON.stringify(saved), true), saved, "refresh preserves receipt and acknowledgements");
}
assert.equal(restoreGuide('{"status":"active","rewardGold":-1}', true).rewardGold, null);
assert.equal(restoreGuide("garbage", true).status, "done");
for (const width of [320, 390, 1440]) {
  const view = { width, height: 740 };
  for (const y of [20, 200, 370, 660]) {
    const target = { x: width / 3, y, width: width / 3, height: 54 };
    const panel = guidePanelPosition(view, 230, target);
    assert.ok(panel.x >= 0 && panel.x + panel.width <= width);
    assert.ok(panel.y >= 0 && panel.y + panel.height <= view.height);
    assert.equal(overlaps(panel, target), false, `${width}px target stays visible at ${y}`);
  }
}
console.log("Guide flow, migration, refresh, skip and responsive placement passed");
