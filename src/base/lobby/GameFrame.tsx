import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { FeatureRegistry, ModeRegistry } from "@idosgames/module-sdk";
import { useLayout, useUiKit, v } from "@idosgames/react/ui";
import type { AppConfig } from "../app-config";
import { BottomTabs, LobbyHeader } from "./Lobby";
import { PLAY, arrangeFeatures, chromeFor, splitTabs } from "./model";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { Account } from "./Account";
import { Earnings } from "./Earnings";
import "./grind-frame.css";

// The game inside the lobby — only a game whose route says `inLobby` (idle-rpg); a full-screen game
// (voxelcraft, board-game) gets just the button back (BackToLobby.tsx). While such a game is on
// screen the base keeps the lobby around it: the same balances, wallet and profile on top (the
// host's `header` slot), the same tabs at the bottom (its `footer` slot) with "Play" lit — "Play"
// IS the game. Any other tab opens that screen in the lobby.
// The host lays the game's canvas and panels out between the two, so a game needs to know nothing.
// In the lobby itself both render nothing — it draws its own.

export interface GameFrameOptions {
  features: FeatureRegistry;
  modes: ModeRegistry;
  /** `lobby` of src/app.config.ts — the same tab order as in the lobby. */
  lobby: AppConfig["lobby"];
  wallet: boolean;
  /** Switch to the lobby and open this screen there (a feature id, or the "More" grid). */
  openInLobby: (id: string) => void;
}

const ghIcon = "https://cloud.idosgames.com/drive/img/98JRCAKG/hard-token.png";

function formatGhBalance(amount: string | undefined): string {
  if (!amount || !/^\d+(?:\.0+)?$/.test(amount)) return "0";
  return BigInt(amount.split(".")[0]!).toLocaleString("en-US");
}

function GrindFrameBalances(): ReactNode {
  const client = useIDosGamesClient();
  const user = useUserState();
  const refreshing = useRef(false);
  const balances = user?.InventoryV2?.VirtualCurrencies ?? {};
  const gh = formatGhBalance(user?.InventoryV2?.CryptoCurrencies?.Main?.Amount);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try { await client.user.getUserInventory(); }
    catch { /* Keep the last confirmed balance until the next refresh. */ }
    finally { refreshing.current = false; }
  }, [client]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return <div className="grind-frame-header__balances">
    {(["GOLD", "GEMS"] as const).map((id) => <div key={id}
      className="grind-frame-header__balance" aria-label={`${id} balance`}>
      <img src={`${import.meta.env.BASE_URL}assets/ui/source/Component/UI_Etc/status_icon_${id === "GOLD" ? "gold" : "gem"}.png`} alt="" />
      <strong>{Number(balances[id]?.Amount ?? 0).toLocaleString()}</strong>
    </div>)}
    <button type="button" className="grind-frame-header__balance grind-frame-header__balance--gh"
      aria-label={`GH balance ${gh}. Refresh balance`} title="GH · Refresh balance"
      onClick={() => void refresh()}>
      <img src={ghIcon} alt="" />
      <strong>{gh}</strong>
    </button>
    <Earnings />
  </div>;
}

function GrindHeaderMenu({ features }: { features: FeatureRegistry }): ReactNode {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const entries = [
    { id: "character", label: "Hero Upgrades" },
    { id: "quests", label: "Quests" },
    { id: "store", label: "Shop" },
  ].filter((entry) => features.get(entry.id)?.available);
  const Screen = screen ? features.get(screen)?.Screen : null;

  useEffect(() => {
    if (!open && !screen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setScreen(null); }
    };
    const onPointer = (event: PointerEvent) => {
      if (open && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, screen]);

  return <div className="grind-header-menu" ref={menuRef}>
    <button type="button" className="grind-header-menu__trigger" aria-label="Open game menu"
      aria-expanded={open} onClick={() => setOpen((value) => !value)}>☰</button>
    {open && <div className="grind-header-menu__dropdown" role="menu" aria-label="Game menu">
      {entries.map((entry) => <button key={entry.id} type="button" role="menuitem"
        onClick={() => { setOpen(false); setScreen(entry.id); }}>{entry.label}</button>)}
      {!entries.length && <span>No features available</span>}
    </div>}
    {Screen && createPortal(<div className="grind-header-feature-overlay"
      onMouseDown={(event) => { if (event.target === event.currentTarget) setScreen(null); }}>
      <section className="grind-header-feature" role="dialog" aria-modal="true"
        aria-label={entries.find((entry) => entry.id === screen)?.label ?? "Game feature"}>
        <header><strong>{entries.find((entry) => entry.id === screen)?.label}</strong>
          <button type="button" aria-label="Close game feature" onClick={() => setScreen(null)}>×</button></header>
        <Screen args={screen === "character" ? { rankOnly: true } : undefined}
          close={() => setScreen(null)} />
      </section>
    </div>, document.body)}
  </div>;
}

/** A game that lives inside the lobby (`inLobby`) is on screen — a full-screen game is not framed. */
function useInGame(modes: ModeRegistry): boolean {
  const current = useSyncExternalStore(
    modes.subscribe,
    modes.current,
    modes.current,
  );
  return chromeFor(modes.list(), current) === "frame";
}

export function makeFrameHeader(options: GameFrameOptions): ComponentType {
  return function GameFrameHeader(): ReactNode {
    const features = useSyncExternalStore(
      options.features.subscribe,
      options.features.list,
      options.features.list,
    );
    const gameMode = useSyncExternalStore(options.modes.subscribe, options.modes.current, options.modes.current);
    if (!useInGame(options.modes)) return null;
    if (gameMode === "idle-rpg") {
      return <div className="grind-frame-header">
        <GrindFrameBalances />
        <div className="grind-frame-header__actions">
          <GrindHeaderMenu features={options.features} />
          <Account features={options.features} />
        </div>
      </div>;
    }
    const store = features.some((f) => f.id === "store" && f.available);
    return (
      <LobbyHeader
        features={options.features}
        wallet={options.wallet}
        pad={12}
        onStore={store ? () => options.openInLobby("store") : null}
        style={{
          padding: "8px 12px 8px",
          background: `linear-gradient(180deg, ${v.bgTop}, ${v.panelDeep})`,
          borderBottom: `2px solid ${v.panelEdge}`,
        }}
      />
    );
  };
}

export function makeFrameTabs(options: GameFrameOptions): ComponentType {
  return function GameFrameTabs(): ReactNode {
    const all = useSyncExternalStore(
      options.features.subscribe,
      options.features.list,
      options.features.list,
    );
    const ref = useRef<HTMLDivElement>(null);
    const layout = useLayout(ref);
    const kit = useUiKit();
    const inGame = useInGame(options.modes);
    const gameMode = useSyncExternalStore(options.modes.subscribe, options.modes.current, options.modes.current);
    if (!inGame) return null;
    if (gameMode === "idle-rpg") return null;

    // The lobby's own split; on a wide screen the lobby has a side rail, over a game — the pill.
    const list = arrangeFeatures(
      all.filter((f) => f.available),
      options.lobby,
    );
    const { tabs, more } = splitTabs(
      list,
      layout === "desktop" ? "tablet" : layout,
    );
    return (
      // The tabs place themselves in the lobby grid's "tabs" area — the same one area here.
      <div ref={ref} style={{ display: "grid", gridTemplateAreas: '"tabs"' }}>
        <BottomTabs
          tabs={tabs}
          more={
            more.length > 0
              ? {
                  badge: more.reduce((s, f) => s + (f.badge > 0 ? 1 : 0), 0),
                  counter: more.some((f) => f.id === "inventory"),
                }
              : null
          }
          current={PLAY}
          pill={layout !== "phone"}
          onPick={(id) => {
            if (id === PLAY) return;
            kit.play("tab");
            options.openInLobby(id);
          }}
        />
      </div>
    );
  };
}
