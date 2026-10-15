import type { ReactNode } from "react";
import type { IdleSession } from "../game/session";
import { heroLevelCost } from "../game/heroLevel";
import { fighterStats } from "../game/heroStats";
import { heroArchetype } from "../game/heroArchetypes";
import { totalBonuses, combatPower, stageHeroStats } from "../game/equipment";
import { petBonus } from "../game/pets";
import { HERO_SKILLS, nextSkillMilestone } from "../game/progressionSkills";
import { SkillIcon, ActiveSkillCard } from "./ActiveSkillCard";
import { activeSkillPresentation } from "./activeSkillPresentation";
import { heroUi } from "./heroAssets";
import "./hero-progression.css";

export function HeroProgression({ session, heroID, tab }: {
  session: IdleSession; heroID: string; tab: "upgrades" | "skills";
}): ReactNode {
  const hero = session.roster.find(h => h.id === heroID);
  const current = session.heroCombatStats(heroID);
  const skill = activeSkillPresentation(heroID, hero?.rank, true);
  if (!hero || !current || !skill) return null;
  const cost = heroLevelCost(hero.def, hero.rank);
  const next = stageHeroStats(fighterStats({ ...hero.input,
    model: { ...hero.input.model, Level: hero.rank + 1 } }), heroArchetype(heroID),
    totalBonuses(session.gearItems, heroID), petBonus(session.petState));
  const upgrade = session.heroUpgrade;
  const number = (value: number) => Number(value.toFixed(2)).toLocaleString("en-US");
  const gold = session.balance("GOLD");
  const affordable = cost !== null && gold >= cost;
  const classId = skill.classId;
  const passive = HERO_SKILLS[classId];
  const milestone = nextSkillMilestone(hero.rank);
  const description = classId === "Knight" ? "Below 30% HP, absorb up to 15% of max HP for 4 seconds. Once per run."
    : classId === "Archer" ? "Every fifth normal attack deals 40% more damage with an empowered arrow."
    : "Meteor burns surviving targets for 12% of Attack each second for 3 seconds. Burns refresh, never stack.";
  return <div className="gh-hero-progression">
    {tab === "upgrades" ? <>
      {milestone ? <section className="gh-next-unlock" aria-label="Next skill unlock">
        <div className="gh-next-unlock__icon"><SkillIcon classId={classId} /></div>
        <div><small>NEXT UNLOCK · LEVEL {milestone.level}</small>
          <h3>{milestone.level === HERO_SKILLS.activeLevel ? skill.name : milestone.level === HERO_SKILLS.passiveLevel ? passive.name : `Mastered ${skill.name}`}</h3>
          <p>{milestone.level === HERO_SKILLS.activeLevel ? "Your signature skill activates automatically in battle." : milestone.label}</p>
          <progress aria-label={`Level progress to ${milestone.label}`} value={hero.rank} max={milestone.level} />
          <span>Level {hero.rank} / {milestone.level}</span></div>
      </section> : <p className="gh-upgrade-max">All skills unlocked · Signature mastered</p>}
      <div className="gh-upgrade-preview-heading"><h3>Grow stronger</h3><span>NOW → LEVEL {Math.min(10, hero.rank + 1)}</span></div>
      <dl className="gh-upgrade-preview">{([
        ["Attack", current.attack, next.attack], ["Max HP", current.maxHp, next.maxHp],
        ["Hero Power", combatPower(current), combatPower(next)],
      ] as const).map(([label, value, future]) => <div key={label}>
        <dt>{label}</dt><dd>{number(value)}{cost !== null ? <> <span>→</span> <b>{number(future)}</b></> : null}</dd>
        {cost !== null ? <small>+{number(future - value)}</small> : null}</div>)}</dl>
      <p className="gh-upgrade-hint">Defence {number(current.defence)} · Attack speed {number(current.attackSpeed)}/s · Move speed {number(current.moveSpeed)}</p>
      <aside className="gh-mastery-note"><strong>Two ways to grow</strong><p><b>Hero Level</b> costs GOLD and improves stats and skills. <b>Stage Mastery {hero.level}</b> comes from battle XP and unlocks equipment rarities.</p></aside>
    </> : <div className="gh-skill-list">
      <p className="gh-upgrade-hint">Skills activate automatically. Normal attacks are always available.</p>
      <ActiveSkillCard heroID={heroID} level={hero.rank} progression />
      <MilestoneCard level={hero.rank} unlock={HERO_SKILLS.passiveLevel} label="PASSIVE" name={passive.name} classId={classId} description={description} />
      <MilestoneCard level={hero.rank} unlock={HERO_SKILLS.masteryLevel} label="SIGNATURE MASTERY" name={`Mastered ${skill.name}`} classId={classId}
        description={`${classId === "Knight" ? "Strike damage: 250% → 275%." : classId === "Archer" ? "Rapid Fire duration: 3 → 3.5 seconds." : "Meteor damage: 180% → 200%."} Cooldown unchanged.`} />
    </div>}
    <footer className="gh-upgrade-dock">
      {upgrade.error ? <p role="alert" className="gh-hero-window__error">{upgrade.error}</p> : null}
      {upgrade.notice && upgrade.noticeHeroID === heroID ? <p role="status" className="gh-upgrade-success" key={upgrade.notice}>{upgrade.notice}</p> : null}
      {cost !== null ? <>
        <div className="gh-upgrade-wallet"><span>Your GOLD</span><strong>{gold.toLocaleString("en-US")}</strong></div>
        <button type="button" className="gh-upgrade-button" disabled={upgrade.busy || !affordable}
          style={{ borderImageSource: `url("${heroUi.primary}")` }} onClick={() => void upgrade.upgrade(hero)}>
          {upgrade.busy ? "Confirming upgrade…" : `Upgrade to Level ${hero.rank + 1}`} <span><img src={heroUi.gold} alt="GOLD" />{cost.toLocaleString("en-US")}</span>
        </button>
        {!affordable ? <p className="gh-upgrade-hint">Need {(cost - gold).toLocaleString("en-US")} more GOLD. Farm cleared stages or collect AFK Rewards.</p> : null}
        <small>Upgrades apply after server confirmation.</small>
      </> : <p className="gh-upgrade-max">{hero.rank >= 10 ? "Maximum Hero Level reached" : "Hero upgrades are unavailable in this environment."}</p>}
    </footer>
  </div>;
}

function MilestoneCard({ level, unlock, label, name, classId, description }: {
  level: number; unlock: number; label: string; name: string; classId: "Knight" | "Archer" | "Mage"; description: string;
}) {
  return <article className={`gh-passive${level < unlock ? " is-locked" : ""}`}>
    <div className="gh-passive__icon"><SkillIcon classId={classId} /></div><div>
      <small>{label} · LEVEL {unlock} · {level >= unlock ? "UNLOCKED" : "LOCKED"}</small>
      <h4>{name}</h4><p>{description}</p>
      {level < unlock ? <p className="gh-skill-lock">Current level {level}/{unlock}</p> : null}</div>
  </article>;
}
