import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IdleSession } from "../game/session";
import { heroLevelEnabled } from "../game/heroLevel";
import { HERO_SKILLS, nextSkillMilestone } from "../game/progressionSkills";
import { HeroProgression } from "./HeroProgression";
import { heroUi } from "./heroAssets";

/** Native modal containment blocks host, footer, pointer and keyboard behind the window. */
export function HeroProgressionDialog({ session, heroID, close }: {
  session: IdleSession; heroID: string; close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleID = useId();
  const [tab, setTab] = useState<"upgrades" | "skills">("upgrades");
  const hero = session.roster.find(entry => entry.id === heroID);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  if (!hero) return null;
  return createPortal(<dialog ref={ref} className="gh-progression-dialog" aria-labelledby={titleID}
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }
    }} style={{ borderImageSource: `url("${heroUi.panel}")` }}>
    <header className="gh-progression-dialog__header"><div><small>GRIND HEROES / HERO PROGRESSION</small><h2 id={titleID}>{hero.name}</h2></div>
      <button type="button" autoFocus onClick={close} aria-label="Close hero progression">×</button></header>
    <div className="gh-progression-dialog__layout">
      <aside className="gh-progression-identity">
        <div className="gh-progression-identity__art"><img src={heroUi.heroIcon(heroID)} alt={hero.name} /></div>
        <span>{heroID === "Knight" ? "FRONTLINE / WARRIOR" : heroID === "Archer" ? "BACKLINE / RANGER" : "BACKLINE / MAGE"}</span>
        <strong key={hero.rank}>Level {hero.rank} <small>/ 10</small></strong>
        <p>Hero Power <b>{session.heroPower(heroID)}</b></p>
        <div className="gh-progression-path" aria-label="Skill milestones">{[HERO_SKILLS.activeLevel, HERO_SKILLS.passiveLevel, HERO_SKILLS.masteryLevel].map((level, index) =>
          <div key={level} className={hero.rank >= level ? "is-unlocked" : ""}><b>{level}</b><span>{["Signature", "Passive", "Mastery"][index]}</span></div>)}</div>
      </aside>
      <div className="gh-progression-dialog__content">
        <div className="gh-progression-tabs" role="tablist" aria-label="Hero progression">
          {(["upgrades", "skills"] as const).map(value => <button type="button" key={value} id={`${titleID}-${value}`} role="tab"
            aria-selected={tab === value} aria-controls={`${titleID}-panel`} tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)} onKeyDown={event => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                event.preventDefault(); const next = value === "upgrades" ? "skills" : "upgrades";
                const target = event.key === "Home" ? "upgrades" : event.key === "End" ? "skills" : next;
                setTab(target); document.getElementById(`${titleID}-${target}`)?.focus();
              }
            }}>{value === "upgrades" ? "UPGRADES" : "SKILLS"}</button>)}
        </div>
        <div role="tabpanel" id={`${titleID}-panel`} aria-labelledby={`${titleID}-${tab}`}>
          <HeroProgression session={session} heroID={heroID} tab={tab} />
        </div>
      </div>
    </div>
  </dialog>, document.body);
}

export function HeroProgressionButton({ session, heroID }: { session: IdleSession; heroID: string }) {
  const [open, setOpen] = useState(false);
  const hero = session.roster.find(entry => entry.id === heroID && entry.rank > 0);
  if (!hero || !heroLevelEnabled(hero.def)) return null;
  const next = nextSkillMilestone(hero.rank);
  return <>
    <button type="button" className="gh-progression-launch" aria-haspopup="dialog" onClick={() => setOpen(true)}
      style={{ borderImageSource: `url("${heroUi.primary}")` }}>
      <img src={heroUi.heroIcon(heroID)} alt="" /><span><strong>UPGRADE HERO</strong>
        <small>{next ? `Level ${next.level} · ${next.label}` : "All skills unlocked"}</small></span><b>Lv {hero.rank} <span>›</span></b>
    </button>
    {open ? <HeroProgressionDialog session={session} heroID={heroID} close={() => setOpen(false)} /> : null}
  </>;
}
