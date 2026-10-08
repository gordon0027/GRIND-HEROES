import { useState, useSyncExternalStore, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { FeatureRegistry } from "@idosgames/module-sdk";
import { Button, Icon, Popup, ResourceList, outlined, useCatalog, useCelebrate, v } from "@idosgames/react/ui";
import type { IdleSession } from "../game/session";
import { formatBig, formatDuration } from "../game/format";
import { t } from "../i18n";
import { InventorySection, TeamSection } from "./ManagementSections";
import { GameFooter, type GameSection } from "./GameFooter";
import { StageMap } from "./StageMap";
import { heroUi } from "./heroAssets";
import { StagePresentation } from "./StagePresentation";
import { emptySlotIcon, rarityColors } from "./inventoryPresentation";
import { gearImage } from "./itemImage";

/** The Phaser scene stays mounted while these four presentation sections change. */
export function makeGamePanel(session: IdleSession, features: FeatureRegistry): ComponentType {
  return function GrindPanel(): ReactNode {
    useSyncExternalStore(session.subscribe, session.getVersion);
    const [section, setSection] = useState<GameSection>("play");
    const run = session.run;
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
          <div className="gh-stage-hud__controls">
            <span className="gh-stage-hud__stage">Stage {run.stage.chapter}-{run.stage.stage}</span>
            <label className="gh-stage-hud__loop"><input type="checkbox" checked={session.loopEnabled}
              onChange={(event) => session.setLoopEnabled(event.target.checked)} /> Loop</label>
            <label className="gh-stage-hud__loop" title="Try the next unlocked stage after a clear"><input
              type="checkbox" checked={session.autoProgressEnabled}
              onChange={(event) => session.setAutoProgressEnabled(event.target.checked)} /> Advance</label>
            {session.awaitingManualStart && session.canManuallyStart ? <button type="button"
              onClick={() => session.startCurrentStage()}>START</button> : null}
            {session.nextStageID ? <button type="button" disabled={!session.canSelectNext}
              onClick={() => { const next = session.nextStageID; if (next) session.selectStage(next); }}>NEXT</button> : null}
          </div>
          {session.lastClearNotice ? <div className="gh-stage-hud__notice" role="status">{session.lastClearNotice}</div> : null}
          {session.lootItems.length ? <div className="gh-stage-hud__notice" role="status">{session.lootItems.join(", ")}</div> : null}
          {session.lootError || session.stageError ? <div className="gh-stage-hud__error" role="alert">{session.lootError ?? session.stageError}</div> : null}
      </div> : <div className="gh-game-section">
        <div className="gh-game-section__inner">
          {section === "inventory" ? <InventorySection session={session} /> : null}
          {section === "team" ? <TeamSection session={session} /> : null}
          {section === "more" ? <MoreSection features={features} session={session} /> : null}
        </div>
      </div>}
      <StageMap session={session} play={section === "play"} />
      <StagePresentation run={run} visible={section === "play"} />
      {session.chestDrop ? <div className="gh-chest-drop-host">
        <ChestDrop key={session.chestDrop.sequence} drop={session.chestDrop} />
      </div> : null}
      {session.lastLevelNotice ? <div className="gh-level-up-notice" role="status">{session.lastLevelNotice}</div> : null}
      <GameFooter section={section} onPick={setSection} />
      {session.away ? <AwayPopup session={session} /> : null}
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
  const entries = [{ id: "character", label: "Hero upgrades" }, { id: "quests", label: "Quests" }, { id: "store", label: "Shop" }, { id: "lootboxes", label: "Summons" }, { id: "marketplace", label: "Marketplace" }]
    .filter((entry) => features.get(entry.id)?.available);
  return <section className={`gh-more-panel${open === "marketplace" ? " gh-more-panel--marketplace" : ""}`}
    style={open === "marketplace" ? { borderImageSource: `url("${heroUi.panel}")` } : undefined}>
    {open !== "marketplace" ? <h2>{open ? entries.find((entry) => entry.id === open)?.label ?? "MORE" : "MORE"}</h2> : null}
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

function AwayPopup({ session }: { session: IdleSession }): ReactNode {
  const away = session.away!;
  const celebrate = useCelebrate();
  const catalog = useCatalog();
  const lines = [{ kind: "currency" as const, id: away.currencyID, amount: away.amount }];
  const close = () => { celebrate(lines); session.dismissAway(); };
  return <Popup title={t("welcomeBack")} onClose={close} width={380} variant="center">
    <div style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
      <div className="idos-bounce"><Icon glyph={catalog.iconOf(lines[0]!)} size={64} /></div>
      <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>{t("awayText")} · {formatDuration(away.seconds)}</div>
      <div style={{ ...outlined, fontSize: 28, color: v.gold }}>+{formatBig(away.amount)}</div>
      <ResourceList lines={lines} size={20} />
      <Button tone="gold" size="lg" attract onClick={close}>{t("collect")}</Button>
    </div>
  </Popup>;
}
