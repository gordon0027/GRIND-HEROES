import assert from "node:assert/strict";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";
import { heroArchetype } from "../src/modules/idle-rpg/game/heroArchetypes.ts";
import { heroProgressionPlan } from "../scripts/hero-progression-plan.mjs";
import { heroLevelCost } from "../src/modules/idle-rpg/game/heroLevel.ts";
import { HeroUpgrade } from "../src/modules/idle-rpg/game/heroUpgrade.ts";
const defs = Object.fromEntries(["Knight", "Archer", "Mage"].map(id => [id, {
  RankLadder:{PriceOptions:{default:{Cost:{Standard:{Entries:[]}}}}}, Stats:{unchanged:1}, Unlock:{unchanged:true},
}]));
const baseline = {Definitions:defs};
const config = heroProgressionPlan(baseline);
assert.deepEqual(config.Definitions.Knight.Stats, baseline.Definitions.Knight.Stats);
assert.equal(baseline.Definitions.Knight.RankLadder.MaxRank, undefined, "plan does not mutate baseline");
assert.deepEqual(Array.from({length:9},(_,i)=>heroLevelCost(config.Definitions.Knight,i+1)),[500,750,1125,1688,2532,3797,5696,8543,12815]);
assert.equal(heroLevelCost(config.Definitions.Knight,10),null);
let resolveUpgrade, calls=0;
const upgrade = new HeroUpgrade({character:{upgradeCharacterLevel:(_id,opts)=>{
  assert.equal(opts.targetLevel,5);calls++;return new Promise(resolve=>{resolveUpgrade=resolve;});
},getUserCharacters:async()=>({ok:true})},user:{getUserInventory:async()=>({ok:true})}},()=>{});
const hero={id:"Knight",name:"Knight",rank:4,def:config.Definitions.Knight};
const pending=upgrade.upgrade(hero);await upgrade.upgrade(hero);assert.equal(calls,1);
resolveUpgrade({ok:true,data:{NewLevel:5}});await pending;assert.match(upgrade.notice,/Signature skill unlocked/);assert.equal(upgrade.busy,false);
const target = {type:"dummy",maxHp:10000,attack:10,defence:0,attackSpeed:1,moveSpeed:0,attackRange:1};
const stage={id:"qa",chapter:1,stage:1,name:"QA",length:101,encounters:[{id:"one",distance:1,enemies:[target]}],boss:{id:"boss",distance:101,enemies:[target]}};
function start(id,level,enabled=true){
  const role=heroArchetype(id),run=new StageRun(stage);
  const source={id,classId:id,level,progressionSkills:enabled,maxHp:100,attack:20,defence:0,attackSpeed:1,
    moveSpeed:140,attackRange:1,combatType:role.combatType,projectile:role.projectile};
  run.setSlots([1,2,3].map(index=>({index,unlocked:index===1,hero:index===1?source:null})));
  run.start();run.tick(1/60);run.heroes[0].x=.5;run.enemies[0].x=.6;run.enemies[0].cooldown=999;
  return run;
}
function frames(run,n){const events=[];for(let i=0;i<n;i++)events.push(...run.tick(1/60));return events;}
for(const id of ["Knight","Archer","Mage"]){
  for (const level of [1, 4]) {
    const run=start(id,level); const events=frames(run,120);
    assert.ok(events.some(e=>e.type==="enemyHit"),`${id} still attacks at level ${level}`);
    assert.equal(events.some(e=>e.type==="skillActivated"||e.type==="skillImpact"),false,`${id} signature locked at ${level}`);
    assert.equal(run.heroes[0].skillCooldown,0);
  }
  const run=start(id,5);assert.ok(frames(run,60).some(e=>e.type==="skillActivated"),`${id} active at level 5`);
}
const knight=start("Knight",8), k=knight.heroes[0];k.hp=29;
knight.hitHero(k,10,1,[]);assert.equal(k.hp,29);assert.equal(k.shieldHp,5);
knight.hitHero(k,10,1,[]);assert.equal(k.hp,24);assert.equal(k.shieldHp,0);
knight.hitHero(k,10,1,[]);assert.equal(k.hp,14,"shield cannot trigger twice");
knight.retry();assert.equal(knight.heroes[0].shieldUsed,false,"retry resets shield");
const expiry=start("Knight",8);expiry.heroes[0].hp=29;expiry.hitHero(expiry.heroes[0],1,1,[]);frames(expiry,241);assert.equal(expiry.heroes[0].shieldHp,0);
const locked=start("Knight",7);locked.heroes[0].hp=29;locked.hitHero(locked.heroes[0],10,1,[]);assert.equal(locked.heroes[0].hp,19);
const disabled=start("Knight",10,false);disabled.heroes[0].hp=29;disabled.hitHero(disabled.heroes[0],10,1,[]);assert.equal(disabled.heroes[0].hp,19,"old environment has no passives");
const archer=start("Archer",8);archer.heroes[0].skillCooldown=999;
const arrows=frames(archer,320).filter(e=>e.type==="enemyHit");
assert.deepEqual(arrows.slice(0,5).map(e=>e.damage),[20,20,20,20,28],"fifth attack empowered");
const mage=start("Mage",8);const fire=frames(mage,250).filter(e=>e.type==="enemyHit");
assert.equal(fire.filter(e=>e.damage===2).length,3,"three burn ticks");
const mageLocked=start("Mage",7);assert.equal(frames(mageLocked,250).filter(e=>e.type==="enemyHit"&&e.damage===2).length,0);
for(const [id,amount] of [["Knight",55],["Mage",40]]){
  const run=start(id,10);const hit=frames(run,90).find(e=>e.type==="enemyHit"&&e.skillId);
  assert.equal(hit.damage,amount,`${id} mastery damage`);
}
const rapid=start("Archer",10);rapid.tick(1/60);assert.equal(rapid.heroes[0].skillBuffRemaining,3.5);
const dying=start("Mage",8);frames(dying,45);dying.enemies[0].hp=1;
const victim=dying.enemies[0].id;
const death=frames(dying,90);assert.ok(death.some(e=>e.type==="enemyDefeated"&&e.id===victim),"burn death clears enemy safely");
assert.ok(dying.enemies.every(e=>!e.burn),"burn does not leak into next encounter");
console.log("Hero level prices, in-flight guard, level-5 skills, level-8 passives, expiry, retry, burn death and level-10 mastery passed");
// Transient refresh errors recover without another upgrade request or balance mutation.
let refreshReads=0,mutations=0;
const retryService=new HeroUpgrade({character:{
  upgradeCharacterLevel:async()=>{mutations++;return {ok:true,data:{NewLevel:5}};},
  getUserCharacters:async()=>({ok:++refreshReads>=3}),
},user:{getUserInventory:async()=>({ok:true})}},()=>{},async()=>{});
await retryService.upgrade(hero);
assert.equal(refreshReads,3);assert.equal(mutations,1);assert.equal(retryService.busy,false);
let readable=false;
const uncertainService=new HeroUpgrade({character:{
  upgradeCharacterLevel:async()=>{mutations++;throw new Error("Connection lost after request");},
  getUserCharacters:async()=>({ok:readable}),
},user:{getUserInventory:async()=>({ok:readable})}},()=>{},async()=>{});
await uncertainService.upgrade(hero);
assert.equal(uncertainService.needsRefresh,true);assert.equal(uncertainService.busy,true);
const beforeRetry=mutations;
await uncertainService.upgrade(hero);assert.equal(mutations,beforeRetry,"uncertain writes remain locked");
readable=true;await uncertainService.refresh();
assert.equal(mutations,beforeRetry,"manual recovery only reads");assert.equal(uncertainService.busy,false);
assert.equal(uncertainService.needsRefresh,false);assert.equal(uncertainService.error,null);
console.log("Upgrade read-back retry, uncertain lock and read-only manual recovery passed");
