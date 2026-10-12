import type { ReactNode } from "react";
import { activeSkillPresentation, type ActiveSkillPresentation } from "./activeSkillPresentation";
import "./active-skill.css";

function SkillIcon({ classId }: { classId: ActiveSkillPresentation["classId"] }): ReactNode {
  if (classId === "Knight") return <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <path d="M11 53C20 32 37 17 57 9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M16 43c12-15 25-24 39-28L41 33 27 47" fill="currentColor" opacity=".82" />
    <path d="m8 48 8 8m-6 3 12-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="m39 8 2 5m9 1 5-3M30 16l-4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
  if (classId === "Archer") return <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <path d="M8 18h35m-11-6 12 6-12 6M15 32h40m-11-6 12 6-12 6M8 46h35m-11-6 12 6-12 6"
      stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12h14M3 32h9M7 52h15" stroke="currentColor" strokeWidth="2" opacity=".6" strokeLinecap="round" />
  </svg>;
  return <svg viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <path d="M39 6c7 13-4 17 3 25 3-4 3-8 3-11 12 10 15 21 7 30-5 6-12 8-20 8-15 0-24-9-24-20 0-10 8-15 8-24 7 4 10 9 9 16 8-7 10-14 14-24Z"
      fill="currentColor" opacity=".75" />
    <path d="M34 29c1 7-7 12-7 19 0 4 3 8 8 8 7 0 11-5 11-11 0-5-4-10-7-13 0 5-2 7-5 9 1-4 1-8 0-12Z"
      fill="#ffdc80" />
    <path d="m13 52-5 4m42-44 5-5M8 30l-5-2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

export function ActiveSkillCard({ heroID }: { heroID: string }): ReactNode {
  const skill = activeSkillPresentation(heroID);
  if (!skill) return null;
  return <section className={`gh-active-skill gh-active-skill--${skill.classId.toLowerCase()}`}
    aria-label={`${skill.name} active skill`} data-skill-id={skill.id}>
    <div className="gh-active-skill__heading">
      <span>ACTIVE SKILL</span>
      <span className="gh-active-skill__auto" title="Activates automatically in combat. Skills cannot be equipped or activated manually."
        aria-label="Activates automatically in combat">AUTO</span>
    </div>
    <div className="gh-active-skill__body">
      <div className="gh-active-skill__icon"><SkillIcon classId={skill.classId} /></div>
      <div className="gh-active-skill__copy">
        <div className="gh-active-skill__title"><h4>{skill.name}</h4><span>Active Skill</span></div>
        <p>{skill.description}</p>
      </div>
    </div>
    <div className="gh-active-skill__details">
      {skill.details.map(({ label, value }) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      <div className="gh-active-skill__cooldown"><span>COOLDOWN</span><strong>{skill.cooldown}</strong></div>
    </div>
  </section>;
}
