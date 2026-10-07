import assert from "node:assert/strict";
import { chestIDs, chestPool } from "../src/modules/idle-rpg/game/chestPools.ts";

assert.deepEqual(chestIDs("stage_chest"), ["stage_chest", "stage_chest_act2", "stage_chest_act3"]);
const stageDefs = { gear_summon: {}, gear_summon_act2: {}, gear_summon_act3: {} };
assert.deepEqual(chestPool("stage_chest", { stage_chest: 2, stage_chest_act2: 1,
  stage_chest_act3: 1 }, stageDefs), { lootboxID: "gear_summon_act3", priceID: "stage" });
assert.deepEqual(chestPool("stage_chest", { stage_chest: 2, stage_chest_act2: 1 }, stageDefs),
  { lootboxID: "gear_summon_act2", priceID: "stage" });
assert.deepEqual(chestPool("stage_chest", { stage_chest: 2 }, stageDefs),
  { lootboxID: "gear_summon", priceID: "stage" });
assert.equal(chestPool("stage_chest", { stage_chest_act3: 1 }, { gear_summon: {} }), null,
  "an Act 3 chest cannot be spent through the Act 1 table");
assert.deepEqual(chestPool("boss_chest", { boss_chest_act3: 1 },
  { boss_summon_act3: {} }), { lootboxID: "boss_summon_act3", priceID: "boss" });
console.log("Act chest routing and legacy stacks passed");
