import assert from "node:assert/strict";
import { onboardingStep } from "../src/modules/idle-rpg/game/onboarding.ts";

const fresh = { active: true, firstClear: false, chestCount: 0, capacity: 1,
  archerOwned: false, archerAssigned: false };
assert.equal(onboardingStep(fresh), "battle");
assert.equal(onboardingStep({ ...fresh, firstClear: true, chestCount: 1 }), "chest");
assert.equal(onboardingStep({ ...fresh, firstClear: true }), "slot");
assert.equal(onboardingStep({ ...fresh, firstClear: true, capacity: 2 }), "recruit");
assert.equal(onboardingStep({ ...fresh, firstClear: true, capacity: 2, archerOwned: true }), "assign");
assert.equal(onboardingStep({ ...fresh, firstClear: true, capacity: 2, archerOwned: true,
  archerAssigned: true }), null);
assert.equal(onboardingStep({ ...fresh, active: false }), null);
console.log("Onboarding steps, completion, and skip passed");
