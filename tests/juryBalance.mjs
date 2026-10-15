// Actual DEV Character curves + 50 equipment definitions. No network calls or grants.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fighterStats } from "../src/modules/idle-rpg/game/heroStats.ts";
import { heroLevelCost } from "../src/modules/idle-rpg/game/heroLevel.ts";
import { heroArchetype } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { stageHeroStats, combatPower, gearBonuses, ZERO_BONUSES, GEAR_SLOTS, RARITY_LEVELS } from "../src/modules/idle-rpg/game/equipment.ts";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";

export const fixture = JSON.parse(readFileSync(new URL("./fixtures/jury-dev-public.json", import.meta.url), "utf8"));
const ids = ["Knight", "Archer", "Mage"];
export function realParty(level, tier, count = 1, pet = {attack:0,maxHp:0}, enhancements = 0) {
  return ids.slice(0, count).map(id => {
    const def = fixture.Character.Definitions[id], role = heroArchetype(id);
    const base = fighterStats({section:fixture.Character, def,
      model:{Level:level,StatLevels:{Damage:enhancements,Health:enhancements}},items:new Map()});
    const gear = {...ZERO_BONUSES};
    if (tier) for (const slot of GEAR_SLOTS) {
      const item = Object.values(fixture.items).find(item => item.Metadata.RarityID === tier &&
        item.Equipment.AllowedSlotIDs.includes(slot) &&
        (!item.Equipment.AllowedCharacterIDs?.length || item.Equipment.AllowedCharacterIDs.includes(id)));
      assert.ok(item, `${id} ${tier} ${slot}`);
      for (const [key, value] of Object.entries(gearBonuses(item))) gear[key] += value;
    }
    return {id,classId:id,level,progressionSkills:true,
      ...stageHeroStats(base,role,gear,pet),combatType:role.combatType,projectile:role.projectile};
  });
}
export const profiles = {
  A:{label:"L1 Knight, no gear",level:1,tier:null,count:1},
  B:{label:"L3 Knight, Common",level:3,tier:"Common",count:1},
  C:{label:"L5 Knight, Common",level:5,tier:"Common",count:1},
  D:{label:"Two L3 heroes, Common",level:3,tier:"Common",count:2},
  E:{label:"Three L3 heroes, Common",level:3,tier:"Common",count:3},
  F:{label:"Three L8 heroes, Rare",level:8,tier:"Rare",count:3},
  G:{label:"Three L10 heroes, Epic",level:10,tier:"Epic",count:3},
  H:{label:"Three L8 heroes, Rare + Donkey",level:8,tier:"Rare",count:3,pet:{attack:0,maxHp:20}},
};
export function simulateReal(stage, party, dt = .05) {
  const run = new StageRun(stage);
  run.setSlots([1,2,3].map(index=>({index,unlocked:index<=party.length,hero:party[index-1]??null})));
  run.start(); let deaths=0,damageTaken=0,casts=0,bossStart=null;
  for (let time=0;time<1200 && !["clear","failed"].includes(run.state);time+=dt) {
    const before = new Map(run.heroes.map(h=>[h.id,h.hp]));
    for (const event of run.tick(dt)) {
      if(event.type==="heroDied") deaths++;
      if(event.type==="skillActivated") casts++;
      if(event.type==="encounterStarted" && event.boss) bossStart=run.elapsedSeconds;
    }
    for(const h of run.heroes) damageTaken+=Math.max(0,(before.get(h.id)??h.hp)-h.hp);
  }
  return {result:run.state,seconds:+run.elapsedSeconds.toFixed(1),deaths,damageTaken:Math.round(damageTaken),casts,
    bossSeconds:bossStart===null?null:+(run.elapsedSeconds-bossStart).toFixed(1),
    goldPerMinute:run.state==="clear"?Math.round(stage.rewards.repeat.gold*60/run.elapsedSeconds):0};
}
export function sweepReal(stages = STAGE_CATALOG) {
  const rows=[];
  for(const [profile,spec] of Object.entries(profiles)) {
    const party=realParty(spec.level,spec.tier,spec.count,spec.pet,spec.enhancements);
    for(const stage of stages) {
      // Deterministic simulation has no RNG. Vary tick cadence rather than invent random seeds.
      const variants=[.025,.05,.1].map(dt=>simulateReal(stage,party,dt));
      rows.push({profile,stage:`${stage.chapter}-${stage.stage}`,power:party.reduce((s,h)=>s+combatPower(h),0),
        recommended:stage.recommendedPower,victoryRate:variants.filter(v=>v.result==="clear").length/variants.length,
        failureRate:variants.filter(v=>v.result==="failed").length/variants.length,...variants[1],variants});
    }
  }
  const prices=Array.from({length:9},(_,i)=>heroLevelCost(fixture.Character.Definitions.Knight,i+1));
  const farm=rows.find(r=>r.profile==="B"&&r.stage==="1-3");
  return {source:fixture.source,method:"240 profiles × 3 deterministic frame cadences; no RNG, no network; six matching slots, instance level 1; mastery eligibility listed separately",
    profiles:Object.fromEntries(Object.entries(profiles).map(([key,spec])=>[key,{...spec,requiredMastery:spec.tier?RARITY_LEVELS[spec.tier]:1}])),
    economy:{levelCosts:prices,totalTo5:prices.slice(0,4).reduce((a,b)=>a+b,0),
      starterGold:500,firstUpgradeAdditionalMinutes:0,afkGoldPerMinute:fixture.idle.Rate.BaseRatePerSecond*60,
      farmingGoldPerMinute:farm.goldPerMinute,minutesTo5AfterStarter:(prices.slice(0,4).reduce((a,b)=>a+b,0)-500)/farm.goldPerMinute},
    contributions: stages.filter(s=>["grind-stage-1-6","grind-stage-1-10","grind-stage-2-10","grind-stage-3-10"].includes(s.id)).map(stage=>({
      stage:`${stage.chapter}-${stage.stage}`,
      knightWithGear:simulateReal(stage,realParty(5,"Common")),knightWithoutGear:simulateReal(stage,realParty(5,null)),
      knightWithSignature:simulateReal(stage,realParty(5,"Common")),
      knightWithoutSignatureSameStats:simulateReal(stage,realParty(5,"Common").map(h=>({...h,level:4}))),
      rareTeam:simulateReal(stage,realParty(8,"Rare",3)),rareTeamWithoutGear:simulateReal(stage,realParty(8,null,3)),
      rareTeamWithDonkey:simulateReal(stage,realParty(8,"Rare",3,{attack:0,maxHp:20}))
    })),rows};
}
if(process.argv[1]?.endsWith("juryBalance.mjs")) {
  const report=sweepReal();
  if(process.argv.includes("--report")) writeFileSync(process.argv[process.argv.indexOf("--report")+1],JSON.stringify(report,null,2)+"\n");
  for(const profile of Object.keys(profiles)) {
    const rows=report.rows.filter(r=>r.profile===profile);
    console.log(profile,profiles[profile].label,rows.map(r=>r.result==="clear"?"W":"L").join(""));
  }
  console.log("Economy",report.economy);
  if(!process.argv.includes("--audit")) {
    const get=(p,s)=>report.rows.find(r=>r.profile===p&&r.stage===s);
    for(const s of ["1-1","1-2","1-3"]) assert.equal(get("A",s).victoryRate,1,`starter onboarding ${s}`);
    assert.equal(get("A","1-6").victoryRate,0,"starter must improve before late Act 1");
    assert.equal(get("C","1-6").victoryRate,1,"level 5 + equipment recovers the wall");
    assert.equal(get("E","3-10").victoryRate,0,"weak party cannot finish campaign");
    assert.equal(get("G","3-10").victoryRate,1,"developed party can finish campaign");
    const noGear=simulateReal(STAGE_CATALOG[5],realParty(5,null));
    assert.ok(get("C","1-6").victoryRate>Number(noGear.result==="clear") || get("C","1-6").seconds<noGear.seconds,"equipment matters");
    console.log("Jury progression scenarios passed");
  }
}
