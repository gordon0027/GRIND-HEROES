import type { ReactNode } from "react";
import { heroUi } from "./heroAssets";
import "./game-foundation.css";

export type GameSection = "play" | "inventory" | "team" | "marketplace" | "rankings";

const entries: Array<{ id: GameSection; label: string; icon: string; ariaLabel?: string }> = [
  { id: "play", label: "PLAY", icon: heroUi.functionIcon("function_icon_battle") },
  { id: "inventory", label: "INVENTORY", icon: heroUi.functionIcon("function_icon_bag_2") },
  { id: "team", label: "TEAM", icon: heroUi.functionIcon("function_icon_user_1") },
  { id: "marketplace", label: "MARKET", icon: heroUi.gold, ariaLabel: "Marketplace" },
  { id: "rankings", label: "RANKINGS", icon: "" },
];

export function GameFooter({ section, onPick }: { section: GameSection; onPick: (section: GameSection) => void }): ReactNode {
  return <nav className="gh-game-footer" aria-label="Grind Heroes sections">
    {entries.map((entry) => <button key={entry.id} type="button"
      aria-current={section === entry.id ? "page" : undefined}
      aria-label={entry.ariaLabel}
      className={section === entry.id ? "is-active" : ""}
      onClick={() => onPick(entry.id)}
      style={{ borderImageSource: `url("${section === entry.id ? heroUi.navActive : heroUi.navIdle}")` }}>
      {entry.id === "rankings" ? <svg className="gh-footer-trophy" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 5h14v9c0 6-3 9-7 9s-7-3-7-9V5Zm0 3H5v5c0 4 3 6 6 6m12-11h4v5c0 4-3 6-6 6M16 23v4m-6 2h12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg> : <img src={entry.icon} alt="" />}
      <span>{entry.label}</span>
    </button>)}
  </nav>;
}
