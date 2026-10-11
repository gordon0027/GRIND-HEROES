import { useState } from "react";
import type { IdleSession } from "../game/session";
import { STAGE_CATALOG } from "../game/stageCatalog";
import type { PreviewTier } from "../game/combatPreview";

/** Local Vite + DEV only; no ownership, currency, rewards or leaderboard writes. */
export function DevCombatPanel({ session }: { session: IdleSession }) {
  const [stage, setStage] = useState(session.run.stage.id);
  const [tier, setTier] = useState<PreviewTier>("Rare");
  const [count, setCount] = useState(3);
  const [pet, setPet] = useState("pet_gold_v1");
  if (!session.devPreviewAvailable) return null;
  return <details style={{ position: "absolute", left: 8, top: 115, zIndex: 10,
    pointerEvents: "auto", background: "#171f2ee8", color: "#eee", padding: 5, fontSize: 11 }}>
    <summary>DEV combat QA</summary>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4,
      width: 205, maxHeight: 160, overflowY: "auto", overflowWrap: "anywhere" }}>
      <select aria-label="QA stage" value={stage} onChange={e => setStage(e.target.value)}>
        {STAGE_CATALOG.map(s => <option key={s.id} value={s.id}>{s.chapter}-{s.stage}</option>)}
      </select>
      <select aria-label="QA gear" value={tier} onChange={e => setTier(e.target.value as PreviewTier)}>
        {["starter", "Common", "Uncommon", "Rare", "Epic"].map(t => <option key={t}>{t}</option>)}
      </select>
      <select aria-label="QA party size" value={count} onChange={e => setCount(Number(e.target.value))}>
        {[1, 2, 3].map(n => <option key={n} value={n}>{n} heroes</option>)}
      </select>
      <select aria-label="QA pet" value={pet} onChange={e => setPet(e.target.value)}>
        <option value="">No pet</option><option value="pet_gold_v1">Donkey</option>
        <option value="pet_gems_v1">Pug</option><option value="pet_gh_v1">Watchdog</option>
      </select>
      <button onClick={() => session.previewCombat(stage, tier, count, pet || null)}>Start QA preview</button>
      <button onClick={() => { session.previewPaused = !session.previewPaused; }}>Pause / resume QA</button>
      <button onClick={() => { session.previewHoldKind = "next"; session.previewHoldCombat = true; }}>Hold next combat</button>
      <button onClick={() => { session.previewHoldKind = "dense"; session.previewHoldCombat = true; }}>Hold six enemies</button>
      <button onClick={() => { session.previewHoldKind = "boss"; session.previewHoldCombat = true; }}>Hold boss combat</button>
      <button onClick={() => { session.previewRate = session.previewRate === 1 ? 4 : 1; }}>QA speed 1× / 4×</button>
      <button onClick={() => session.setDevPreview(null)}>Exit QA preview</button>
      <output>{session.run.state} · {session.run.enemies.length} enemies · {session.previewPaused ? "paused" : "playing"} · no rewards</output>
      <output aria-label="QA render metrics">{JSON.stringify(session.renderDiagnostics)}</output>
    </div>
  </details>;
}
