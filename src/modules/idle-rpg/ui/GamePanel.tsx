import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { FeatureRegistry } from "@idosgames/module-sdk";
import { Button, Popup, ResourceList, v } from "@idosgames/react/ui";
import type { IdleSession } from "../game/session";
import { formatBig, formatDuration } from "../game/format";
import { t } from "../i18n";
import { InventorySection, TeamSection } from "./ManagementSections";
import { GameFooter, type GameSection } from "./GameFooter";
import { StageMap } from "./StageMap";
import { STAGE_CATALOG } from "../game/stageCatalog";
import { stageUnlocked } from "../game/stageProgress";
import { heroUi } from "./heroAssets";
import { StagePresentation } from "./StagePresentation";
import { emptySlotIcon, rarityColors } from "./inventoryPresentation";
import { gearImage } from "./itemImage";
import "./away-popup.css";

/** The Phaser scene stays mounted while the footer sections change. */
export function makeGamePanel(session: IdleSession, features: FeatureRegistry): ComponentType {
  return function GrindPanel(): ReactNode {
    useSyncExternalStore(session.subscribe, session.getVersion);
    const [section, setSection] = useState<GameSection>("play");
    const [mapOpen, setMapOpen] = useState(false);
    useEffect(() => {
      if (!mapOpen) return;
      const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMapOpen(false); };
      window.addEventListener("keydown", closeOnEscape);
      return () => window.removeEventListener("keydown", closeOnEscape);
    }, [mapOpen]);
    const [collectedAway, setCollectedAway] = useState<{ currencyID: string; amount: number } | null>(null);
    const market = features.get("marketplace");
    const MarketplaceScreen = market?.available ? market.Screen : null;
    const run = session.run;
    const stageIndex = STAGE_CATALOG.findIndex((stage) => stage.id === run.stage.id);
    const previous = STAGE_CATALOG[stageIndex - 1];
    const next = STAGE_CATALOG[stageIndex + 1];
    const canSelect = !session.lootPending && !session.lootBusy;
    const canGo = (stage: typeof previous) => !!stage && canSelect &&
      (session.isDevPreview || stageUnlocked(session.stageProgress, stage.id));
    const location = run.stage.name.split(" · ")[1] ?? run.stage.name;
    const percent = Math.min(100, run.distance / run.stage.length * 100);
    return <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: v.font, color: v.text }}>
      {section === "play" ? <div className="gh-stage-hud" style={{ top: 8 }}>
          <div className="gh-stage-hud__frame">
            <div role="progressbar" aria-label="Stage progress" aria-valuenow={Math.floor(run.distance)} aria-valuemax={run.stage.length}
              className="gh-stage-hud__track"><div className="gh-stage-hud__fill" style={{ width: `${percent}%` }} /></div>
            <div className="gh-stage-hud__boss" title="Boss">
              <img src={`${import.meta.env.BASE_URL}assets/ui/icons/boss/boss_icon.png`} alt="Boss" />
            </div>
          </div>
          <div className="gh-stage-hud__chests">
            {(["stage_chest", "boss_chest"] as const).map((itemID) => <button type="button" key={itemID}
              className="gh-stage-hud__chest" disabled={!session.chestConfigured(itemID) || session.chestCount(itemID) === 0 || session.lootBusy}
              aria-label={`${itemID === "stage_chest" ? "Stage" : "Boss"} chest, ${session.chestCount(itemID)} available`}
              onClick={() => void session.openChest(itemID)}>
              <img src={`${import.meta.env.BASE_URL}assets/ui/chests/${itemID}.png`} alt="" />
              <b aria-hidden="true">×{session.chestCount(itemID)}</b>
            </button>)}
          </div>
          {session.lastClearNotice ? <div className="gh-stage-hud__notice" role="status">{session.lastClearNotice}</div> : null}
          {session.lootItems.length ? <div className="gh-stage-hud__notice" role="status">{session.lootItems.join(", ")}</div> : null}
          {session.lootError || session.stageError ? <div className="gh-stage-hud__error" role="alert">{session.lootError ?? session.stageError}</div> : null}
      </div> : <div className="gh-game-section">
        <div className="gh-game-section__inner">
          {section === "inventory" ? <InventorySection session={session} /> : null}
          {section === "team" ? <TeamSection session={session} /> : null}
          {section === "marketplace" ? <section className="gh-more-panel gh-more-panel--marketplace"
            style={{ borderImageSource: `url("${heroUi.panel}")` }}>
            {MarketplaceScreen ? <MarketplaceScreen close={() => setSection("play")} />
              : <div className="gh-market-unavailable" role="status">
                <h2>MARKETPLACE</h2><p>Маркетплейс пока недоступен.</p>
              </div>}
          </section> : null}
          {section === "more" ? <MoreSection features={features} session={session} /> : null}
        </div>
      </div>}
      {section === "play" ? <div className="gh-play-lower">
        <section className="gh-stage-navigator" aria-label="Stage navigator">
          <div className="gh-stage-navigator__top">
            <span>ACT {run.stage.chapter} · {location}</span>
            <label className="gh-stage-navigator__advance">
              <input type="checkbox" checked={session.autoProgressEnabled}
                onChange={(event) => session.setAutoProgressEnabled(event.target.checked)} />
              AUTO ADVANCE {session.autoProgressEnabled ? "ON" : "OFF"}
            </label>
          </div>
          <div className="gh-stage-navigator__controls">
            <button type="button" aria-label="Previous stage" disabled={!canGo(previous)}
              onClick={() => { if (previous) session.selectStage(previous.id); }}>‹</button>
            <strong>Current Stage: {run.stage.chapter}-{run.stage.stage}</strong>
            <button type="button" aria-label="Next stage" disabled={!canGo(next)}
              onClick={() => { if (next) session.selectStage(next.id); }}>›</button>
            <button type="button" className="gh-stage-navigator__map" aria-label="Open stage map"
              onClick={() => setMapOpen(true)}><img src={heroUi.functionIcon("function_icon_map")} alt="" /> MAP</button>
          </div>
        </section>
        <div className="gh-play-dashboard">
          <div className="gh-play-dashboard__card"><span>TEAM POWER</span><strong>{session.teamPower === null ? "—" : session.teamPower.toLocaleString("en-US")}</strong></div>
          <div className="gh-play-dashboard__card"><span>GH RANK</span><strong>{session.teamLeaderboard?.rank ? `#${session.teamLeaderboard.rank}` : "—"}</strong></div>
        </div>
      </div> : null}
      {mapOpen && section === "play" ? <div className="gh-stage-map-overlay"
        role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapOpen(false); }}>
        <div className="gh-stage-map-dialog" role="dialog" aria-modal="true" aria-label="Stage map">
          <button type="button" className="gh-stage-map-close" aria-label="Close stage map"
            onClick={() => setMapOpen(false)}>×</button>
          <StageMap session={session} onSelect={() => setMapOpen(false)} />
        </div>
      </div> : null}
      <StagePresentation run={run} visible={section === "play"} />
      {session.chestDrop ? <div className="gh-chest-drop-host">
        <ChestDrop key={session.chestDrop.sequence} drop={session.chestDrop} />
      </div> : null}
      {session.lastLevelNotice ? <div className="gh-level-up-notice" role="status">{session.lastLevelNotice}</div> : null}
      <GameFooter section={section} onPick={(next) => {
        if (next === section) return;
        setMapOpen(false);
        setSection(next);
        if (next === "inventory" || next === "team" || section === "more" || section === "marketplace")
          void session.refreshOwnership();
      }} />
      {session.away ? <AwayPopup session={session} onCollect={setCollectedAway} /> : null}
      {collectedAway ? <Popup title="AFK REWARDS" onClose={() => setCollectedAway(null)} width={380} variant="center">
        <div className="gh-away gh-away--collected">
          <div className="gh-away__caption">You got</div>
          <div className="gh-away__reward">
            {collectedAway.currencyID === "GOLD" ? <>
              <img src={heroUi.gold} alt="Gold" />
              <strong>+{formatBig(collectedAway.amount)}</strong><span>GOLD</span>
            </> : <ResourceList lines={[{ kind: "currency", id: collectedAway.currencyID, amount: collectedAway.amount }]} size={28} />}
          </div>
          <Button className="gh-away__button" tone="gold" size="lg" onClick={() => setCollectedAway(null)}>Great!</Button>
        </div>
      </Popup> : null}
    </div>;
  };
}

function ChestDrop({ drop }: { drop: NonNullable<IdleSession["chestDrop"]> }): ReactNode {
  const { item } = drop;
  const fallback = emptySlotIcon(item.slot, item.allowedHeroes[0] ?? "Knight");
  const image = gearImage(item) ?? (fallback.startsWith("function_")
    ? heroUi.functionIcon(fallback) : heroUi.itemIcon(fallback));
  return <div className="gh-chest-drop" role="status"
    style={{ "--gh-rarity": rarityColors[item.rarity] } as CSSProperties}>
    <div className="gh-chest-drop__art" style={{ backgroundImage: `url("${heroUi.slot}")` }}>
      <img className={`gh-chest-drop__frame${item.rarity === "Common" ? " gh-chest-drop__frame--common" : ""}`}
        src={heroUi.rarityFrame(item.rarity)} alt="" />
      <img className="gh-chest-drop__icon" src={image} alt="" />
    </div>
    <div className="gh-chest-drop__text"><strong>{item.name}</strong><span>{item.rarity}</span></div>
  </div>;
}

function MoreSection({ features, session }: { features: FeatureRegistry; session: IdleSession }): ReactNode {
  const [open, setOpen] = useState<string | null>(null);
  const Screen = open ? features.get(open)?.Screen : null;
  const entries = [{ id: "character", label: "Hero upgrades" }, { id: "quests", label: "Quests" }, { id: "store", label: "Shop" }]
    .filter((entry) => features.get(entry.id)?.available);
  return <section className="gh-more-panel">
    <h2>{open ? entries.find((entry) => entry.id === open)?.label ?? "MORE" : "MORE"}</h2>
    {Screen ? <><button className="gh-more-panel__back" type="button" onClick={() => setOpen(null)}>← MORE</button>
      <Screen args={open === "character" ? { rankOnly: true } : undefined} close={() => setOpen(null)} /></> : <>
    <div className="gh-more-panel__grid">{entries.map((entry) => <button key={entry.id} type="button"
      style={{ borderImageSource: `url("${heroUi.navIdle}")` }}
      onClick={() => setOpen(entry.id)}>{entry.label}</button>)}</div>
    {session.devPreviewAvailable ? <details style={{ marginTop: 24, color: "#a89c8b" }}><summary>DEV preview</summary>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <button onClick={() => session.setDevPreview(null)}>Real party</button>
        <button onClick={() => session.setDevPreview(2)}>2 heroes</button>
        <button onClick={() => session.setDevPreview(3)}>3 heroes</button>
        <button onClick={() => session.previewStage("grind-stage-1-10")}>Act 1 boss stage</button>
        <button onClick={() => session.previewStage("grind-stage-2-1")}>Act 2 start</button>
        <button onClick={() => session.previewStage("grind-stage-2-5")}>Act 2 middle</button>
        <button onClick={() => session.previewStage("grind-stage-2-10")}>Act 2 boss stage</button>
        <button onClick={() => session.previewStage("grind-stage-3-1")}>Act 3 start</button>
        <button onClick={() => session.previewStage("grind-stage-3-5")}>Act 3 middle</button>
        <button onClick={() => session.previewStage("grind-stage-3-10")}>Act 3 boss stage</button>
      </div>
    </details> : null}</>}
  </section>;
}

function AwayPopup({ session, onCollect }: { session: IdleSession; onCollect: (reward: { currencyID: string; amount: number }) => void }): ReactNode {
  const away = session.away!;
  const closed = useRef(false);
  const lines = [{ kind: "currency" as const, id: away.currencyID, amount: away.amount }];
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onCollect({ currencyID: away.currencyID, amount: away.amount });
    session.dismissAway();
  };
  return <Popup title="AFK REWARDS" onClose={close} width={380} variant="center">
    <div className="gh-away">
      <div className="gh-away__caption">{t("welcomeBack")}</div>
      <div className="gh-away__time">{t("awayText")} · {formatDuration(away.seconds)}</div>
      <div className="gh-away__reward">
        {away.currencyID === "GOLD" ? <>
          <img src={heroUi.gold} alt="Gold" />
          <strong>+{formatBig(away.amount)}</strong><span>GOLD</span>
        </> : <ResourceList lines={lines} size={28} />}
      </div>
      <Button className="gh-away__button" tone="gold" size="lg" onClick={close}>{t("collect")}</Button>
    </div>
  </Popup>;
}
