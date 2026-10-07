// @idosgames/mod-idle-rpg — the Idle RPG game (Phaser + React) for the host shell: a Legend
// Slime-style auto-battler — waves, bosses with a timer, skills, gold from the server's idle accrual
// spent on the hero's stats. Heroes, gear, summons, quests and the shop are the platform's systems.
//
// Primary export is the module manifest; the rest is exposed so a project can recompose the pieces
// (a different screen over the same fight, the fight under a different screen) after copying this
// into src/modules/.

export { idleRpgModule } from "./module";

export { IdleSession, pickHero, PROGRESS_KEY } from "./game/session";
export {
  Battle,
  SKILLS,
  type BattleEvent,
  type BattleSnapshot,
} from "./game/battle";
export {
  fighterStats,
  resolveStats,
  statCost,
  statCap,
  type FighterStats,
} from "./game/heroStats";
export { stageInfo, THEMES } from "./game/stages";
export { pickIncome, incomePerSecond } from "./game/economy";
export { formatBig } from "./game/format";
export { IdleRpgController } from "./game/IdleRpgController";
export { BattleScene } from "./phaser/BattleScene";
export { createIdleRpgScene } from "./scene";
export { makeGamePanel } from "./ui/GamePanel";
export { characterUpgraded, stageCleared } from "./events";
