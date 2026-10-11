// Real DEV SDK regression. A fresh guest fights 1-1 at wall-clock speed before claiming.
import assert from "node:assert/strict";
import { createIDosGamesClient } from "@idosgames/core";
import { StageRun, FIRST_STAGE } from "../src/modules/idle-rpg/game/stageRun.ts";
import { HERO_ARCHETYPES } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { ordinaryPrices } from "../scripts/dev-economy-plan.mjs";
const titleID=process.env.IDOS_TITLE_ID??"98JRCAKG-DEV";
assert.ok(titleID.endsWith("-DEV"),"verify refuses PROD");
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const client=createIDosGamesClient({titleID,throttleMs:0});
assert.equal((await client.auth.loginWithDeviceID()).ok,true,"DEV guest login");
// Match IdleSession's first-login formation repair/materialization before starting.
assert.equal((await client.userCustomData.setPrivateData("grind_formation_v2",
  JSON.stringify({version:2,slots:["Knight",null,null]}))).ok,true,"persist starter formation");
const config=client.data.config.config;
const cloud=async(name,args)=>{
  const result=await client.cloudCode.execute(name,args);
  assert.equal(result.ok,true,`${name} transport`);
  assert.equal(result.data.Error??null,null,`${name}: ${JSON.stringify(result.data.Error)}`);
  return result.data.FunctionResult;
};
const prices=await cloud("getPartySlotPrices");
assert.equal(prices.slot2,ordinaryPrices.slot2);assert.equal(prices.slot3,ordinaryPrices.slot3);
for(const id of ["Archer","Mage"])
  assert.equal(config.Character.Definitions[id].Unlock.PriceOptions.default.Cost.Standard.Entries[0].Amount,ordinaryPrices[id]);
for(const id of ["gold_bag_small","gold_bag_big"])
  assert.equal(config.Store.StoreOffers[id].Pricing.Options.default.Cost.Standard.Entries[0].Amount,ordinaryPrices[id]);
assert.equal(config.Reward.IdleAccruals.idle_gold.Rate.BaseRatePerSecond,ordinaryPrices.idlePerSecond);
const started=await cloud("startStageRun",{stageId:FIRST_STAGE.id});
assert.equal(started.accepted,true);
const tooEarly=await cloud("completeStageRun",{stageId:FIRST_STAGE.id,runId:started.runId});
assert.equal(tooEarly.accepted,false,"no early rewards");
const role=HERO_ARCHETYPES.Knight, stats=config.Character.Definitions.Knight.Stats;
const run=new StageRun(FIRST_STAGE);
run.setSlots([{index:1,unlocked:true,hero:{id:"Knight",classId:"Knight",level:1,
  maxHp:stats.Health.BaseStatValue,attack:stats.Damage.BaseStatValue,
  defence:0,attackSpeed:stats.AttackSpeed.BaseStatValue,moveSpeed:role.moveSpeed,
  attackRange:role.attackRange,combatType:role.combatType,projectile:role.projectile}},
  {index:2,unlocked:false,hero:null},{index:3,unlocked:false,hero:null}]);
run.start();console.log("DEV config matched; real 1-1 combat running, early completion rejected");
let previous=performance.now();
while(!["clear","failed"].includes(run.state)){
  await new Promise(resolve=>setTimeout(resolve,50));
  const now=performance.now();run.tick((now-previous)/1000);previous=now;
}
assert.equal(run.state,"clear");
const completed=await cloud("completeStageRun",{stageId:FIRST_STAGE.id,runId:started.runId});
assert.equal(completed.accepted,true);
assert.equal(completed.rewards.gold,FIRST_STAGE.rewards.repeat.gold);
assert.equal(completed.xpAwards.find(x=>x.heroID==="Knight").amount,FIRST_STAGE.rewards.repeat.heroXP);
await new Promise(resolve=>setTimeout(resolve,3100)); // Respect DEV's handler cooldown.
assert.equal((await cloud("completeStageRun",{stageId:FIRST_STAGE.id,runId:started.runId})).accepted,false,"duplicate rejected");
assert.equal((await client.user.getUserInventory()).ok,true);
assert.equal(client.data.user.state.InventoryV2.Items.stage_chest.StackableAmount,1);
console.log(JSON.stringify({passed:true,titleID,seconds:Math.round(run.elapsedSeconds),gold:completed.rewards.gold,
  heroXP:FIRST_STAGE.rewards.repeat.heroXP,chests:1,earlyRejected:true,duplicateRejected:true}));
process.exit(0);
