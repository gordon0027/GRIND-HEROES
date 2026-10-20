import { useRef, useState, useSyncExternalStore, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { FeatureRegistry } from "@idosgames/module-sdk";
import { Button, Popup, ResourceList, v } from "@idosgames/react/ui";
import type { IdleSession } from "../game/session";
import { formatBig, formatDuration } from "../game/format";
import { t } from "../i18n";
import { InventorySection, RankingsSection, TeamSection } from "./ManagementSections";
import { GameFooter, type GameSection } from "./GameFooter";
import { StageMapDialog } from "./StageMap";
import { STAGE_CATALOG } from "../game/stageCatalog";
import { stageUnlocked } from "../game/stageProgress";
import { heroUi } from "./heroAssets";
import { StagePresentation } from "./StagePresentation";
import { emptySlotIcon, rarityColors } from "./inventoryPresentation";
import { gearImage } from "./itemImage";
import "./away-popup.css";
import { DevCombatPanel } from "./DevCombatPanel";
import { StagePreparation } from "./StagePreparation";
import { heroLevelCost } from "../game/heroLevel";
import { HERO_SKILLS } from "../game/progressionSkills";

/** The Phaser scene stays mounted while the footer sections change. */
export function makeGamePanel(session: IdleSession, features: FeatureRegistry): ComponentType {
  return function GrindPanel(): ReactNode {
    useSyncExternalStore(session.subscribe, session.getVersion);
    const [section, setSection] = useState<GameSection>("play");
    const [mapOpen, setMapOpen] = useState(false);
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
    const stageChestReady = session.chestCount("stage_chest") > 0;
    const gearReady = session.gearItems.some((item) => !item.equippedBy &&
      session.roster.some((hero) => !session.equipmentProblem(item, hero.id)));
    const growingHero = session.roster.find(hero => hero.rank > 0 && hero.rank < HERO_SKILLS.activeLevel);
    const upgradeCost = growingHero ? heroLevelCost(growingHero.def, growingHero.rank) : null;
    const location = run.stage.name.split(" · ")[1] ?? run.stage.name;
    const percent = Math.min(100, run.distance / run.stage.length * 100);
    const guideStep = session.currentOnboardingStep;
    const guide = guideStep ? <div className="gh-onboarding" role="status">
      <div className="gh-onboarding__copy">
        <small>YOUR FIRST PARTY</small>
        <strong>{({ battle: "Your Knight is already fighting", chest: "Your first reward is ready",
          slot: "Make room for a second hero", recruit: "Recruit your Archer",
          assign: "Put Archer in Slot 2" })[guideStep]}</strong>
        <p>{({ battle: "Watch the battle. Your hero attacks automatically, and the first clear earns GOLD and a chest.",
          chest: "Open the Stage Chest to reveal your first equipment.",
          slot: "Open TEAM and unlock Slot 2 with the GOLD from your first clear.",
          recruit: "In TEAM, choose Recruit Hero and select Archer.",
          assign: "In TEAM, select the empty Slot 2, then choose Archer from your roster." })[guideStep]}</p>
      </div>
      <div className="gh-onboarding__actions">
        {guideStep === "chest" && section === "play" ? <button type="button"
          onClick={() => void session.openChest("stage_chest")}>OPEN CHEST</button> : null}
        {["slot", "recruit", "assign"].includes(guideStep) && section !== "team" ?
          <button type="button" onClick={() => setSection("team")}>OPEN TEAM</button> : null}
        {guideStep === "chest" && section !== "play" ? <button type="button"
          onClick={() => setSection("play")}>OPEN PLAY</button> : null}
        <button type="button" className="gh-onboarding__skip" onClick={() => session.skipOnboarding()}>SKIP TUTORIAL</button>
      </div>
    </div> : null;
    return <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: v.font, color: v.text }}>
      {import.meta.env.DEV && session.devPreviewAvailable ? <DevCombatPanel session={session} /> : null}
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
              className={`gh-stage-hud__chest${session.chestCount(itemID) > 0 ? " is-ready" : ""}`}
              disabled={!session.chestConfigured(itemID) || session.chestCount(itemID) === 0 || session.lootBusy}
              aria-label={`${itemID === "stage_chest" ? "Stage" : "Boss"} chest, ${session.chestCount(itemID)} available`}
              onClick={() => void session.openChest(itemID)}>
              <img src={`${import.meta.env.BASE_URL}assets/ui/chests/${itemID}.png`} alt="" />
              {session.chestCount(itemID) > 0 ? <span className="gh-stage-hud__chest-action">OPEN</span> : null}
              <b aria-hidden="true">×{session.chestCount(itemID)}</b>
            </button>)}
          </div>
          {session.lastClearNotice ? <div className="gh-stage-hud__notice" role="status">{session.lastClearNotice}</div> : null}
          {session.lootItems.length ? <div className="gh-stage-hud__notice" role="status">{session.lootItems.join(", ")}</div> : null}
          {session.lootError || session.stageError ? <div className="gh-stage-hud__error" role="alert">{session.lootError ?? session.stageError}</div> : null}
      </div> : <div className="gh-game-section">
        <div className="gh-game-section__inner">
          {guide}
          {section === "inventory" ? <InventorySection session={session} onPlay={() => setSection("play")} /> : null}
          {section === "team" ? <TeamSection session={session} /> : null}
          {section === "marketplace" ? <section className="gh-more-panel gh-more-panel--marketplace"
            style={{ borderImageSource: `url("${heroUi.panel}")` }}>
            {MarketplaceScreen ? <MarketplaceScreen close={() => setSection("play")} />
              : <div className="gh-market-unavailable" role="status">
                <h2>MARKETPLACE</h2><p>Маркетплейс пока недоступен.</p>
              </div>}
          </section> : null}
          {section === "rankings" ? <RankingsSection session={session} /> : null}
        </div>
      </div>}
      {section === "play" ? <div className="gh-play-lower">
        {guide}
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
        <StagePreparation session={session} />
        <div className="gh-play-goal" aria-label="Next step">
          <span>NEXT STEP</span>
          {stageChestReady ? <><strong>Stage Chest ready</strong><p>Open the chest to reveal your equipment.</p>
            <button type="button" disabled={session.lootBusy} onClick={() => void session.openChest("stage_chest")}>OPEN CHEST</button></>
            : gearReady ? <><strong>Equip your new gear</strong><p>Equipment raises your hero's Power.</p>
              <button type="button" onClick={() => { setSection("inventory"); void session.refreshOwnership(); }}>INVENTORY</button></>
            : growingHero && upgradeCost !== null && session.balance("GOLD") >= upgradeCost ? <>
              <strong>Upgrade your {growingHero.name}</strong><p>Spend GOLD on Hero Level. Level {HERO_SKILLS.activeLevel} unlocks an automatic signature skill.</p>
              <button type="button" onClick={() => setSection("team")}>HERO PROGRESSION</button></>
            : <><strong>Heroes fight automatically</strong><p>{next && !stageUnlocked(session.stageProgress, next.id)
              ? `Clear this stage to unlock ${next.chapter}-${next.stage} and earn a Stage Chest.`
              : "Farm cleared stages for GOLD and chests. Equip loot, upgrade heroes, then push further."}</p></>}
        </div>
      </div> : null}
      {mapOpen && section === "play" ? <StageMapDialog session={session} close={() => setMapOpen(false)} /> : null}
      <StagePresentation run={run} visible={section === "play"}
        confirmedReward={!session.isDevPreview && run.state === "clear" &&
          session.validatedClearSeconds !== null && !session.lootPending &&
          session.lootItems.length > 0
          ? [`+${session.lootGold.toLocaleString("en-US")} GOLD`, ...session.lootItems].join(" · ")
          : null} />
      {session.chestDrop ? <div className="gh-chest-drop-host">
        <ChestDrop key={session.chestDrop.sequence} drop={session.chestDrop} />
      </div> : null}
      {session.lastLevelNotice ? <div className="gh-level-up-notice" role="status">{session.lastLevelNotice}</div> : null}
      <GameFooter section={section} onPick={(next) => {
        if (next === section) return;
        setMapOpen(false);
        setSection(next);
        if (next === "rankings") void session.loadTeamLeaderboard();
        if (next === "inventory" || next === "team" || section === "marketplace")
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
