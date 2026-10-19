import assert from "node:assert/strict";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { enemyDensity, enemySpawnX, enemyGroundSlot } from "../src/modules/idle-rpg/game/encounterLayout.ts";
import { previewParty } from "../src/modules/idle-rpg/game/combatPreview.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";
import { simulate } from "./balanceSweep.mjs";
import { PET_VISUALS } from "../src/modules/idle-rpg/phaser/petVisuals.ts";
import { ENEMY_VISUALS } from "../src/modules/idle-rpg/phaser/enemyVisuals.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

let previousTotal = 0, previousPower = 0;
for (const stage of STAGE_CATALOG) {
  const [low, high] = enemyDensity(stage.chapter, stage.stage);
  const total = stage.encounters.reduce((n, wave) => n + wave.enemies.length, stage.boss.enemies.length);
  assert.ok(total >= previousTotal, `${stage.id}: density never decreases`);
  assert.ok(stage.recommendedPower > previousPower);
  assert.equal(stage.boss.distance, stage.length);
  for (const wave of stage.encounters) {
    assert.ok(wave.enemies.length >= low && wave.enemies.length <= high, stage.id);
    const xs = wave.enemies.map((e, i) => enemySpawnX(i, e.combatType === "RANGED"));
    assert.equal(new Set(xs).size, xs.length, "spawns do not clamp onto one point");
    const slots = wave.enemies.map((_, i) => JSON.stringify(enemyGroundSlot(i)));
    assert.equal(new Set(slots).size, slots.length, "stable visual ground slots are distinct");
    const melee = xs.filter((_, i) => wave.enemies[i].combatType !== "RANGED");
    for (let i = 0; i < wave.enemies.length; i++)
      if (wave.enemies[i].combatType === "RANGED") assert.ok(xs[i] > Math.max(...melee));
  }
  assert.ok(stage.encounters[0].enemies.length <= stage.encounters.at(-1).enemies.length);
  previousTotal = total; previousPower = stage.recommendedPower;
}
assert.equal(STAGE_CATALOG[0].boss.enemies.length, 1);
assert.equal(STAGE_CATALOG.at(-1).boss.enemies.length, 3);

// Killing the named boss never clears an encounter while one guard is alive.
const finale = STAGE_CATALOG.at(-1);
const bossOnly = { ...finale, length: 1, encounters: [], boss: { ...finale.boss, distance: 1 } };
const run = new StageRun(bossOnly);
run.setSlots([{ index: 1, unlocked: true, hero: previewParty("Epic", 1)[0] },
  { index: 2, unlocked: false, hero: null }, { index: 3, unlocked: false, hero: null }]);
run.start(); run.tick(0.1);
assert.equal(run.state, "boss");
assert.equal(run.enemies.filter(e => e.boss).length, 1, "guards have ordinary timing/HP bars");
run.enemies[0].hp = 1;
run.enemies[0].x = run.heroes[0].x + 0.05;
run.heroes[0].attack = 9999;
for (let i=0;i<100 && run.enemies.some(e=>e.boss);i++) run.tick(1/60);
assert.ok(run.enemies.length > 0);
assert.equal(run.state, "boss", "all guards must die before stage completion");

for (const [id, v] of Object.entries(PET_VISUALS)) {
  const png = readFileSync(`public${v.assetPath}`);
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a", "actual pet asset is a PNG");
  assert.equal(png.readUInt32BE(16), v.frameWidth * 12, `${id}: sheet columns match frames`);
  assert.equal(png.readUInt32BE(20), v.frameHeight * 4, `${id}: all animation rows fit`);
  assert.equal(v.feetByFrame.length, 48);
  assert.ok(v.feetByFrame.every(y => y > 0 && y <= v.frameHeight), id);
  assert.equal(v.originY * v.frameHeight, v.feetByFrame[0]);
  assert.ok(v.offsetY <= 12 && v.scale * v.frameHeight >= 45 && v.scale * v.frameHeight <= 75);
}
for (const v of Object.values(ENEMY_VISUALS))
  if (v.frameWidth === 256) assert.equal(v.originY * v.frameHeight, 183, "boots rather than low weapon pixels");

const results=[];
for (const [chapter, stage] of [[1,1],[1,5],[1,10],[2,1],[2,5],[2,10],[3,1],[3,5],[3,10]]) {
  for (const [name, tier, count, pet] of [["starter","starter",1,false],
    ["commonKnight","Common",1,false],["uncommonDuo","Uncommon",2,false],
    ["rareTrio","Rare",3,false],["rareTrioDonkey","Rare",3,true],["epicTrio","Epic",3,false]]) {
    const party=previewParty(tier,count).map(h=>({...h,maxHp:h.maxHp+(pet?20:0)}));
    const result=simulate(chapter,stage,party);
    results.push({profile:name,...result});
    if (chapter===1 && stage===1) assert.equal(result.result,"clear");
    if (tier==="Epic") assert.equal(result.result,"clear");
    if (chapter===3 && tier==="starter") assert.equal(result.result,"failed");
    if (chapter===3 && stage===10 && name==="uncommonDuo") assert.equal(result.result,"failed",
      "a low-Power duo cannot farm the finale");
    if (tier==="Rare") assert.equal(result.result,"clear", "an appropriately geared full party clears");
    if (result.result==="clear") assert.ok(result.seconds > STAGE_CATALOG.find(s=>s.chapter===chapter&&s.stage===stage).minimumClearSeconds && result.seconds<1200);
  }
}
if (process.env.GRIND_WRITE_BALANCE_REPORT === "1") {
  mkdirSync("artifacts/release-evidence",{recursive:true});
  writeFileSync("artifacts/release-evidence/legacy-profile-simulations.json",JSON.stringify(results,null,2));
}
console.log("30-stage density, stable spawn slots, boss guards, pet anchors and 54 combat profiles passed");
