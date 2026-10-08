import type { ReactNode } from "react";
import { heroUi } from "./heroAssets";
import "./game-foundation.css";

export type GameSection = "play" | "inventory" | "team" | "marketplace" | "more";

const entries: Array<{ id: GameSection; label: string; icon: string; ariaLabel?: string }> = [
  { id: "play", label: "PLAY", icon: heroUi.functionIcon("function_icon_battle") },
  { id: "inventory", label: "INVENTORY", icon: heroUi.functionIcon("function_icon_bag_2") },
  { id: "team", label: "TEAM", icon: heroUi.functionIcon("function_icon_user_1") },
  { id: "marketplace", label: "MARKET", icon: heroUi.gold, ariaLabel: "Marketplace" },
  { id: "more", label: "MORE", icon: heroUi.functionIcon("function_icon_menu_1") },
];

export function GameFooter({ section, onPick }: { section: GameSection; onPick: (section: GameSection) => void }): ReactNode {
  return <nav className="gh-game-footer" aria-label="Grind Heroes sections">
    {entries.map((entry) => <button key={entry.id} type="button"
      aria-current={section === entry.id ? "page" : undefined}
      aria-label={entry.ariaLabel}
      className={section === entry.id ? "is-active" : ""}
      onClick={() => onPick(entry.id)}
      style={{ borderImageSource: `url("${section === entry.id ? heroUi.navActive : heroUi.navIdle}")` }}>
      <img src={entry.icon} alt="" />
      <span>{entry.label}</span>
    </button>)}
  </nav>;
}
