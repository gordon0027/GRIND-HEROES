// Reproducible, read-only balance tables. Run after npm run test:polish.
import { readFileSync, writeFileSync } from "node:fs";
import { STAGE_CATALOG } from "../src/modules/idle-rpg/game/stageCatalog.ts";
import { previewParty } from "../src/modules/idle-rpg/game/combatPreview.ts";
import { ghCombatPower } from "../src/modules/idle-rpg/game/powerFormula.js";

const stages = STAGE_CATALOG.map((s, ordinal) => ({
  stage: `${s.chapter}-${s.stage}`, goldBefore: 30 + ordinal * 8 + [0,80,200][s.chapter-1] +
    [0,10,20][s.chapter-1] * (s.stage-1), goldAfter: s.rewards.repeat.gold,
  xpBefore: 25 + ordinal * 5, xpAfter: s.rewards.repeat.heroXP,
  recommendedBefore: Math.round([80,240,450][s.chapter-1] +
    ([220,420,680][s.chapter-1] - [80,240,450][s.chapter-1]) * (s.stage-1)/9),
  recommendedAfter: s.recommendedPower,
  groups: s.encounters.map(e=>e.enemies.length), bossGroup: s.boss.enemies.length,
  total: s.encounters.reduce((n,e)=>n+e.enemies.length,s.boss.enemies.length),
  hpRange: [Math.min(...s.encounters.flatMap(e=>e.enemies.map(v=>v.maxHp))),
    Math.max(...s.encounters.flatMap(e=>e.enemies.map(v=>v.maxHp)))],
  attackRange: [Math.min(...s.encounters.flatMap(e=>e.enemies.map(v=>v.attack))),
    Math.max(...s.encounters.flatMap(e=>e.enemies.map(v=>v.attack)))],
  boss: {hp:s.boss.enemies[0].maxHp,attack:s.boss.enemies[0].attack,
    defence:s.boss.enemies[0].defence,attackSpeed:s.boss.enemies[0].attackSpeed},
}));
const simulations=JSON.parse(readFileSync("artifacts/combat-polish/profile-simulations.json","utf8"));
const profiles=Object.fromEntries([["starter","starter",1],["commonKnight","Common",1],
  ["uncommonDuo","Uncommon",2],["rareTrio","Rare",3],["epicTrio","Epic",3]].map(([name,tier,count])=>{
    const party=previewParty(tier,count);
    return [name,{power:party.reduce((n,h)=>n+ghCombatPower(h),0),party}];
  }));
writeFileSync("artifacts/combat-polish/balance-tables.json",JSON.stringify({stages,profiles},null,2));
const rewards=["| Stage | GOLD before | GOLD after | XP before | XP after |",
  "|---|---:|---:|---:|---:|",...stages.map(s=>`| ${s.stage} | ${s.goldBefore} | ${s.goldAfter} | ${s.xpBefore} | ${s.xpAfter} |`)];
const sim=["| Stage | Bare Knight | Common Knight | Uncommon duo | Rare trio | Rare + Donkey | Epic trio |",
  "|---|---:|---:|---:|---:|---:|---:|",...stages.filter(s=>simulations.some(v=>v.stage===s.stage)).map(s=>
  `| ${s.stage} | `+["starter","commonKnight","uncommonDuo","rareTrio","rareTrioDonkey","epicTrio"].map(p=>{
    const v=simulations.find(v=>v.stage===s.stage&&v.profile===p);
    return v.result==="clear"?`${v.seconds}s`:`defeat (${v.seconds}s)`;
  }).join(" | ")+" |")];
writeFileSync("artifacts/combat-polish/tables.md",rewards.join("\n")+"\n\n"+sim.join("\n")+"\n");
console.log(JSON.stringify({profiles:Object.fromEntries(Object.entries(profiles).map(([k,v])=>[k,v.power])),stages:stages.length,simulations:simulations.length}));
