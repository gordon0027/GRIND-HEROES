import assert from "node:assert/strict";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { realParty, simulateReal } from "./progressionBalance.mjs";
// Campaign regression uses real Character definitions, separate Hero Level and gear mastery.
for (const stage of STAGE_CATALOG) {
  const party = stage.chapter===1 ? stage.stage===1 ? realParty(1,null) : stage.stage<=4 ? realParty(3,"Common") : realParty(5,"Common",2)
    : stage.chapter===2 ? realParty(8,"Rare",3) : realParty(10,"Epic",3);
  const outcome=simulateReal(stage,party);
  assert.equal(outcome.result,"clear",`${stage.id}: ${JSON.stringify(outcome)}`);
  assert.ok(outcome.seconds>stage.minimumClearSeconds && outcome.seconds<600,"finite, server-valid duration");
  assert.equal(outcome.deaths,0,`${stage.id} should remain farmable by an appropriately prepared team`);
  assert.ok(outcome.bossSeconds>0 && outcome.bossSeconds<45,"readable boss duration");
}
const noGear=simulateReal(STAGE_CATALOG[5],realParty(3,null));
const common=simulateReal(STAGE_CATALOG[5],realParty(3,"Common"));
assert.equal(noGear.result,"failed");assert.equal(common.result,"clear");
const beforeSkill=simulateReal(STAGE_CATALOG[9],realParty(4,"Common"));
const withSkill=simulateReal(STAGE_CATALOG[9],realParty(5,"Common"));
assert.equal(beforeSkill.result,"failed");assert.equal(withSkill.result,"clear");
assert.ok(withSkill.casts>0);
console.log("All 30 real-stat farming scenarios, equipment recovery and level-5 skill spike passed");
