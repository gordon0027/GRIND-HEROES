import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IdleSession } from "../game/session";
import type { OnboardingStep } from "../game/onboarding";
import type { GameSection } from "./GameFooter";
import { guidePanelPosition, overlaps, type GuideRect } from "./guideLayout";
import { heroUi } from "./heroAssets";
import "./adventure-guide.css";

const copy = {
  welcome: ["A new adventure awaits", "Welcome to Grind Heroes! Your adventure begins now."],
  battle: ["Your Knight leads the way", "Your heroes fight automatically. Watch your Knight take on the forest!"],
  victory: ["Your first victory!", "You've earned GOLD to build your team. Let's find your Knight a companion."],
  slot: ["Make room for a companion", "Unlock your second party slot."],
  recruit: ["Meet your Archer", "Recruit an Archer. Ranged heroes support your Knight."],
  assign: ["Stronger together", "Add your Archer to the team."],
  complete: ["Your team is ready!", "Your real adventure begins now."],
} as const;
const progress: Record<NonNullable<OnboardingStep>, number> = {
  welcome: 1, battle: 2, victory: 3, slot: 5, recruit: 6, assign: 7, complete: 8,
};
const targetElement = (name: string) => document.querySelector<HTMLElement>(`[data-guide-target="${name}"]`);

function findTarget(step: OnboardingStep, section: GameSection): HTMLElement | null {
  if (!["slot", "recruit", "assign"].includes(step ?? "")) return null;
  const targets = section !== "team" ? ["nav-team"] : step === "slot" ? ["unlock-confirm", "slot-2"] :
    step === "recruit" ? ["archer-confirm", "archer-choice", "recruit-open"] : ["formation-archer", "slot-2"];
  return targets.map(targetElement).find(el => el && el.getClientRects().length > 0) ?? null;
}

/** One guide for the existing controls. It has no purchase or reward authority. */
export function AdventureGuide({ session, section, onExit }: {
  session: IdleSession; section: GameSection; onExit: () => void;
}) {
  const step = session.currentOnboardingStep;
  const panel = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const [bounds, setBounds] = useState<GuideRect | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [panelHeight, setPanelHeight] = useState(240);
  const maskID = useId();
  const guided = step === "slot" || step === "recruit" || step === "assign";
  const blocking = !!step && step !== "battle";
  const exit = () => { session.skipOnboarding(); onExit(); };

  useLayoutEffect(() => {
    if (!step) return;
    let frame = 0;
    let current: HTMLElement | null = null;
    let disposed = false;
    const observer = new ResizeObserver(() => schedule());
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const el = findTarget(step, section);
      if (el !== current) {
        if (current) observer.unobserve(current);
        current = el;
        target.current = el;
        if (el) {
          observer.observe(el);
          el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
          el.focus({ preventScroll: true });
        }
      }
      const rect = el?.getBoundingClientRect();
      const view = { width: window.innerWidth, height: window.innerHeight };
      const height = panel.current?.offsetHeight ?? 240;
      const next = rect ? {
        x: Math.max(4, rect.left - 5), y: Math.max(4, rect.top - 5),
        width: Math.min(view.width - 4, rect.right + 5) - Math.max(4, rect.left - 5),
        height: Math.min(view.height - 4, rect.bottom + 5) - Math.max(4, rect.top - 5),
      } : null;
      // A nested scroll container can put a target under the dialogue or fixed nav.
      // Move the real control, never a cloned button, into the available space.
      const position = guidePanelPosition(view, height, next);
      if (el && next && (overlaps(position, next) || rect!.bottom > view.height - 8 || rect!.top < 8)) {
        let parent = el.parentElement;
        while (parent && parent.scrollHeight <= parent.clientHeight + 2) parent = parent.parentElement;
        if (parent) {
          const clip = parent.getBoundingClientRect();
          const top = Math.max(12, clip.top + 8);
          const bottom = Math.min(view.height - next.height - 16, clip.bottom - next.height - 8);
          const candidates = [bottom, top].map(y => {
            const scroll = Math.max(0, Math.min(parent!.scrollHeight - parent!.clientHeight,
              parent!.scrollTop + rect!.top - y));
            const moved = { ...next, y: next.y - (scroll - parent!.scrollTop) };
            const fits = !overlaps(guidePanelPosition(view, height, moved), moved);
            return { scroll, fits };
          });
          const candidate = candidates.find(c => c.fits);
          if (candidate && Math.abs(candidate.scroll - parent.scrollTop) > 2)
            parent.scrollTo({ top: candidate.scroll, behavior: "instant" });
        }
      }
      setViewport(before => before.width === view.width && before.height === view.height ? before : view);
      setPanelHeight(before => before === height ? before : height);
      setBounds(before => JSON.stringify(before) === JSON.stringify(next) ? before : next);
    };
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(measure); };
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["disabled", "aria-pressed", "data-guide-target"] });
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    measure();
    if (blocking && !guided) panel.current?.querySelector<HTMLButtonElement>(".gh-guide__continue")?.focus({ preventScroll: true });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      mutations.disconnect(); observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      target.current = null;
    };
  }, [step, section]);

  useEffect(() => {
    if (!blocking) return;
    const allowed = (node: EventTarget | null) => node instanceof Node &&
      (panel.current?.contains(node) || target.current?.contains(node));
    const onClick = (event: MouseEvent) => {
      // Missing targets release interaction immediately; Skip always remains available.
      if (guided && !target.current) return;
      if (!allowed(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); exit(); return; }
      if (guided && !target.current) return;
      if (event.key === "Tab") {
        const controls = [target.current, ...Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
          .filter((el): el is HTMLElement => !!el && !(el instanceof HTMLButtonElement && el.disabled));
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        if (controls.length) { event.preventDefault(); event.stopImmediatePropagation(); controls[next]?.focus({ preventScroll: true }); }
      } else if (["Enter", " "].includes(event.key) && !allowed(event.target)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey, true); };
  }, [blocking, guided, step, section]);

  if (!step) return null;
  const openTeam = guided && section !== "team";
  const number = openTeam ? 4 : progress[step];
  const label = target.current?.dataset.guideTarget;
  const message = openTeam ? "Let's build a stronger team. Open your Team!" :
    label === "unlock-confirm" && session.slotCosts ? `Unlock this slot for ${session.slotCosts[2].toLocaleString("en-US")} GOLD. Your new companion will have a place in the party.` :
    label === "archer-confirm" && session.recruitCost("Archer") !== null ? `Recruit Archer for ${session.recruitCost("Archer")!.toLocaleString("en-US")} GOLD. Then add them to your party.` :
    step === "assign" && label === "slot-2" ? "Choose your empty second slot, then select Archer." : copy[step][1];
  const position = guidePanelPosition(viewport, panelHeight, guided ? bounds : null);
  const error = step === "slot" ? session.slotPurchaseError : step === "recruit" ? session.recruitError :
    step === "assign" ? session.formationError : null;
  return createPortal(<div className={`gh-guide${guided ? " gh-guide--guided" : ""}${step === "battle" ? " gh-guide--battle" : ""}`} data-guide-step={step}>
    {blocking && (!guided || bounds) ? <svg className="gh-guide__shade" width="100%" height="100%" aria-hidden="true">
      <defs><mask id={maskID}><rect width="100%" height="100%" fill="white" />
        {guided && bounds ? <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} rx="8" fill="black" /> : null}
      </mask></defs><rect width="100%" height="100%" fill="#080605" fillOpacity=".72" mask={`url(#${maskID})`} />
    </svg> : null}
    {guided && bounds ? <div className="gh-guide__spotlight" aria-hidden="true"
      style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }} /> : null}
    <div ref={panel} className={`gh-guide__panel${["victory", "complete"].includes(step) ? " gh-guide__panel--celebrate" : ""}`}
      role={step === "battle" ? "status" : guided ? "region" : "dialog"} aria-label="Adventure guide" aria-modal={!guided && blocking || undefined}
      style={step === "battle" ? undefined : { left: position.x, top: position.y, width: position.width }}>
      <div className="gh-guide__heading"><span>ADVENTURE GUIDE</span><span>{number} / 8</span></div>
      <div className="gh-guide__story"><div className="gh-guide__portrait"><img src={heroUi.heroIcon(step === "complete" ? "Archer" : "Knight")} alt="" /></div>
        <div><h2>{copy[step][0]}</h2><p>{message}</p></div></div>
      {step === "victory" ? <div className="gh-guide__reward"><img src={heroUi.gold} alt="" />
        <strong>{session.guideProgress.rewardGold !== null ? `+${session.guideProgress.rewardGold.toLocaleString("en-US")}` : "GOLD"}</strong>
        <span>{session.guideProgress.rewardGold !== null ? "GOLD RECEIVED" : "REWARD RECEIVED"}</span></div> : null}
      {error ? <p className="gh-guide__error" role="alert">{error}</p> : null}
      <div className="gh-guide__foot"><div className="gh-guide__steps" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < number ? "is-lit" : ""} />)}</div>
        <button type="button" className="gh-guide__skip" onClick={exit}>Skip tutorial</button>
        {["welcome", "victory", "complete"].includes(step) ? <button type="button" className="gh-guide__continue"
          onClick={() => { session.continueOnboarding(); if (step === "complete") onExit(); }}>
          {step === "welcome" ? "LET'S GO" : step === "complete" ? "START ADVENTURE" : "CONTINUE"}<span aria-hidden="true"> →</span></button> : null}
      </div>
      {guided ? <span className="gh-guide__instruction">{!bounds ? "Explore freely while the guide finds your next step." : "Follow the golden light"}</span> : null}
    </div>
  </div>, document.body);
}
