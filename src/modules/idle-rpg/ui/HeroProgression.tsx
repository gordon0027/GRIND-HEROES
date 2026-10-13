import type { ReactNode } from "react";
import type { IdleSession } from "../game/session";
import { heroLevelCost, heroLevelEnabled } from "../game/heroLevel";
import { fighterStats } from "../game/heroStats";
import { heroArchetype } from "../game/heroArchetypes";
import { totalBonuses, combatPower, stageHeroStats } from "../game/equipment";
import { petBonus } from "../game/pets";
import { HERO_SKILLS } from "../game/progressionSkills";
import { SkillIcon, ActiveSkillCard } from "./ActiveSkillCard";
import { heroUi } from "./heroAssets";
import "./hero-progression.css";

export function HeroProgression({ session, heroID }: { session: IdleSession; heroID: string }): ReactNode {
  const hero = session.roster.find(h => h.id === heroID);
  if (!hero || hero.rank < 1 || !heroLevelEnabled(hero.def)) return null;
  const cost = heroLevelCost(hero.def, hero.rank);
  const current = session.heroCombatStats(heroID)!;
  const next = stageHeroStats(fighterStats({ ...hero.input,
    model: { ...hero.input.model, Level: hero.rank + 1 } }), heroArchetype(heroID),
    totalBonuses(session.gearItems, heroID), petBonus(session.petState));
  const upgrade = session.heroUpgrade;
  const number = (value: number) => Number(value.toFixed(2)).toLocaleString("en-US");
  const affordable = cost !== null && session.balance("GOLD") >= cost;
  const classId = heroID as keyof typeof HERO_SKILLS.mastery;
  const passive = HERO_SKILLS[classId];
  if (!passive) return null;
  const description = classId === "Knight" ? "Below 30% HP, absorb up to 15% of max HP for 4s. Once per run."
    : classId === "Archer" ? "Every fifth attack deals 40% more damage with an empowered arrow."
    : "Meteor burns surviving targets for 12% of Attack each second for 3s. Burns refresh, never stack.";
  return <section className="gh-hero-progression" aria-label={`${hero.name} progression`}>
    <header><div><small>HERO PROGRESSION</small><h3>Level {hero.rank} <span>/ 10</span></h3></div>
      <strong>Power {session.heroPower(heroID)}</strong></header>
    {cost !== null ? <>
      <dl className="gh-upgrade-preview"><div><dt>Attack</dt><dd>{number(current.attack)} → <b>{number(next.attack)}</b></dd></div>
        <div><dt>HP</dt><dd>{number(current.maxHp)} → <b>{number(next.maxHp)}</b></dd></div>
        <div><dt>Power</dt><dd>{combatPower(current)} → <b>{combatPower(next)}</b></dd></div></dl>
      <button type="button" className="gh-upgrade-button" disabled={upgrade.busy || !affordable}
        onClick={() => void upgrade.upgrade(hero)}>
        {upgrade.busy ? "Confirming upgrade…" : `Upgrade to Level ${hero.rank + 1}`} <span><img src={heroUi.gold} alt="Gold" />{cost.toLocaleString("en-US")}</span>
      </button>
      {!affordable ? <p className="gh-upgrade-hint">Need {(cost - session.balance("GOLD")).toLocaleString("en-US")} more GOLD. Earn it in stages and AFK rewards.</p> : null}
      <p className="gh-upgrade-hint">Next milestone: Level {hero.rank < 5 ? "5 · passive skill" : "10 · active skill mastery"}</p>
    </> : <p className="gh-upgrade-max">Maximum level reached · active skill mastered</p>}
    {upgrade.error ? <p role="alert" className="gh-hero-window__error">{upgrade.error}</p> : null}
    {upgrade.notice && upgrade.noticeHeroID === heroID ? <p role="status" className="gh-upgrade-success">{upgrade.notice}</p> : null}
    <p className="gh-upgrade-hint">Stage Mastery uses your existing XP to unlock equipment. GOLD levels improve combat stats and skills.</p>
    <h3 className="gh-skills-heading">Skills</h3><ActiveSkillCard heroID={heroID} level={hero.rank} progression />
    <article className={`gh-passive${hero.rank < 5 ? " is-locked" : ""}`}>
      <div className="gh-passive__icon"><SkillIcon classId={classId} /></div><div>
        <small>PASSIVE · LEVEL 5 · {hero.rank >= 5 ? "UNLOCKED" : "LOCKED"}</small>
        <h4>{passive.name}</h4><p>{description}</p></div></article>
    <article className={`gh-passive${hero.rank < 10 ? " is-locked" : ""}`}>
      <div className="gh-passive__icon"><SkillIcon classId={classId} /></div><div>
        <small>ACTIVE UPGRADE · LEVEL 10 · {hero.rank >= 10 ? "UNLOCKED" : "LOCKED"}</small>
        <h4>Mastered {classId === "Knight" ? "Crushing Blow" : classId === "Archer" ? "Rapid Fire" : "Meteor"}</h4>
        <p>{classId === "Knight" ? "Strike damage: 250% → 275%." : classId === "Archer" ? "Rapid Fire duration: 3s → 3.5s." : "Meteor damage: 180% → 200%."} Cooldown unchanged.</p>
      </div></article>
  </section>;
}
