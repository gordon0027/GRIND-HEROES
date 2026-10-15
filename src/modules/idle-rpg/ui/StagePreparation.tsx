import type { IdleSession } from "../game/session";
import { combatPower } from "../game/equipment";
import "./stage-preparation.css";

export function StagePreparation({session}: {session:IdleSession}) {
  const power = session.isDevPreview ? session.run.heroes.reduce((sum,h)=>sum+combatPower(h),0) : session.teamPower;
  const recommended = session.run.stage.recommendedPower;
  const difference = power === null || recommended === undefined ? null : power-recommended;
  return <section className={`gh-stage-preparation${difference !== null && difference < 0 ? " is-underpowered" : ""}`} aria-label="Stage preparation">
    <div><span>TEAM POWER</span><strong>{power?.toLocaleString("en-US") ?? "—"}</strong></div>
    <div><span>RECOMMENDED POWER</span><strong>{recommended?.toLocaleString("en-US") ?? "—"}</strong></div>
    <p><b>{difference === null ? "Power unavailable" : difference === 0 ? "Meets recommendation" : difference < 0 ? `${Math.abs(difference)} below recommendation` : `${difference} above recommendation`}</b>
      <span>{difference === null ? "Your team strength will appear after refresh." : difference < 0 ? "Your team may struggle. Upgrade heroes, equip stronger gear or add a teammate." : "Ready to push. Skills, equipment and formation still matter."}</span></p>
    <small>A preparation guide; Power does not guarantee a win.</small>
  </section>;
}
