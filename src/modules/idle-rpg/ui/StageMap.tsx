import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@idosgames/react/ui";
import { STAGE_CATALOG, STAGES_PER_CHAPTER } from "../game/stageCatalog";
import { chapterAvailable } from "../game/stageFlow";
import { stageUnlocked } from "../game/stageProgress";
import type { StageDefinition } from "../game/stageRun";
import type { IdleSession } from "../game/session";
import { heroUi } from "./heroAssets";

type Position = { x: number; y: number };

const desktopPositions: Position[] = Array.from({ length: STAGES_PER_CHAPTER }, (_, index) => ({
  x: index < 5 ? 10 + index * 20 : 90 - (index - 5) * 20,
  y: index < 5 ? 26 : 76,
}));
const mobilePositions: Position[] = Array.from({ length: STAGES_PER_CHAPTER }, (_, index) => ({
  x: index % 2 === 0 ? 34 : 66,
  y: 7 + index * 9.5,
}));
const bossSheets = ["assets/enemies/ogreboss/ogreboss.png",
  "assets/enemies/act2/OrangeOgre.png", "assets/enemies/act3/ZombieOgre.png"];

function MapRoute({ stages, session, positions, mobile }: {
  stages: readonly StageDefinition[];
  session: IdleSession;
  positions: Position[];
  mobile: boolean;
}): ReactNode {
  return <svg className={`gh-map-route gh-map-route--${mobile ? "mobile" : "desktop"}`}
    viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    {stages.slice(1).map((stage, index) => {
      const from = positions[index]!;
      const to = positions[index + 1]!;
      const unlocked = session.isDevPreview || stageUnlocked(session.stageProgress, stage.id);
      const completed = (session.stageProgress.completed[stage.id] ?? 0) > 0;
      return <line key={stage.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        className={`gh-map-route__link${unlocked ? " is-unlocked" : ""}${completed ? " is-completed" : ""}`}
        vectorEffect="non-scaling-stroke" />;
    })}
  </svg>;
}

export function StageMap({ session, play }: { session: IdleSession; play: boolean }): ReactNode {
  const [chapter, setChapter] = useState(session.run.stage.chapter);
  const selectedID = session.run.stage.id;
  useEffect(() => setChapter(session.run.stage.chapter), [selectedID, session.run.stage.chapter]);
  const chapters = [...new Set(STAGE_CATALOG.map((stage) => stage.chapter))];
  const stages = STAGE_CATALOG.filter((stage) => stage.chapter === chapter);
  const current = session.run.stage;
  const chapterUnlocked = (number: number) => session.isDevPreview || chapterAvailable(number, session.stageProgress);
  const chapterName = stages[0]?.name.split(" · ")[1] ?? `Chapter ${chapter}`;
  const selectedVisible = current.chapter === chapter;

  return <section className={`gh-stage-map-host${play ? " is-play" : ""}`}
    aria-label="Stage map" data-chapter={chapter}>
    <div className="gh-stage-map">
      <header className="gh-stage-map__header">
        <div className="gh-stage-map__heading"><img src={heroUi.functionIcon("function_icon_map")} alt="" />
          <div><span>PORTAL</span><strong>Stage Map</strong></div></div>
        <div className="gh-stage-map__chapters" role="group" aria-label="Chapters">
          {chapters.map((number) => <button key={number} type="button"
            className={number === chapter ? "is-active" : ""}
            aria-pressed={number === chapter}
            disabled={!chapterUnlocked(number)}
            onClick={() => setChapter(number)}
            style={{ borderImageSource: `url("${number === chapter ? heroUi.primary : heroUi.secondary}")` }}>
            {chapterUnlocked(number) ? `ACT ${number}` : <><img src={heroUi.lock} alt="" /> ACT {number}</>}
          </button>)}
        </div>
        <span className="gh-stage-map__location">{chapterName}</span>
      </header>
      <div className={`gh-stage-map__land gh-stage-map__land--${chapter}`}>
        <span className="gh-stage-map__land-title">ACT {chapter} <small>{chapterName}</small></span>
        <MapRoute stages={stages} session={session} positions={desktopPositions} mobile={false} />
        <MapRoute stages={stages} session={session} positions={mobilePositions} mobile />
        {stages.map((stage, index) => {
          const unlocked = session.isDevPreview || stageUnlocked(session.stageProgress, stage.id);
          const completed = (session.stageProgress.completed[stage.id] ?? 0) > 0;
          const selected = stage.id === selectedID;
          const boss = stage.stage === STAGES_PER_CHAPTER;
          const special = !boss && !!stage.rewards?.repeat.bossChestItemID;
          const spot = desktopPositions[index]!;
          const mobileSpot = mobilePositions[index]!;
          const style = { "--x": `${spot.x}%`, "--y": `${spot.y}%`,
            "--mx": `${mobileSpot.x}%`, "--my": `${mobileSpot.y}%` } as CSSProperties;
          return <button key={stage.id} type="button" style={style}
            className={`gh-map-node${unlocked ? " is-unlocked" : " is-locked"}${completed ? " is-completed" : ""}${selected ? " is-current" : ""}${boss ? " is-boss" : ""}${special ? " is-special" : ""}`}
            disabled={!unlocked || session.lootPending || session.lootBusy}
            aria-label={`Stage ${stage.chapter}-${stage.stage}, ${selected ? "currently farming" : completed ? "completed" : unlocked ? "unlocked" : "locked"}${boss ? ", chapter boss" : ""}`}
            aria-current={selected ? "location" : undefined}
            title={`${stage.name} · ${selected ? "Farming" : unlocked ? "Farm this stage" : "Locked"}`}
            onClick={() => session.selectStage(stage.id)}>
            {selected && <span className="gh-map-node__party"><img src={heroUi.functionIcon("function_icon_battle")} alt="" /></span>}
            <span className="gh-map-node__disc">
              {boss ? <span className="gh-map-node__ogre" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${bossSheets[chapter - 1]})` }} /> :
                !unlocked ? <img className="gh-map-node__lock" src={heroUi.lock} alt="" /> :
                completed ? <span className="gh-map-node__check">✓</span> :
                <span className="gh-map-node__number">{String(stage.stage).padStart(2, "0")}</span>}
            </span>
            <span className="gh-map-node__label">{stage.chapter}-{stage.stage}</span>
            {special && <span className="gh-map-node__special" aria-hidden="true"><Icon glyph="chest" size={14} /></span>}
          </button>;
        })}
      </div>
      <div className="gh-stage-map__detail">
        <div className="gh-stage-map__detail-main"><strong>{selectedVisible ? current.name : chapterName}</strong>
          <span>{selectedVisible ? "FARMING HERE" : `Farming ${current.chapter}-${current.stage} · Act ${current.chapter}`}</span></div>
        {selectedVisible && <div className="gh-stage-map__detail-stats">
          <span>Best <b>{session.stageProgress.bestSeconds[current.id] == null ? "—" : `${session.stageProgress.bestSeconds[current.id]!.toFixed(1)}s`}</b></span>
          <span>Power <b>{current.recommendedPower ?? "—"}</b></span>
          <span>Rewards <b>{current.rewards?.repeat.gold ?? 0} GOLD · Stage Chest{current.rewards?.repeat.bossChestItemID ? " · Boss Chest" : ""}</b></span>
        </div>}
      </div>
    </div>
  </section>;
}
