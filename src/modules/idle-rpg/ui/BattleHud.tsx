import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Icon,
  outlined,
  toneSurface,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import type { IdleSession } from "../game/session";
import { formatBig } from "../game/format";
import { stageInfo } from "../game/stages";
import { t } from "../i18n";

// What sits on top of the fight: the stage title, the wave pips or the boss timer, the "Boss!"
// button after a failed boss, and short banners when the stage turns. Everything else of the fight is
// on the canvas. The top-left corner stays free — the base's "To the lobby" button lives there.

type Banner = { text: string; tone: "gold" | "red" | "blue"; key: number };

export function BattleHud({ session }: { session: IdleSession }): ReactNode {
  const snap = session.battle.snapshot();
  const info = stageInfo(snap.stage);
  const kit = useUiKit();
  const banner = useBanner(session);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: v.font,
        color: v.text,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "calc(10px + var(--idos-safe-top, 0px))",
          left: 64,
          right: 64,
          display: "grid",
          justifyItems: "center",
          gap: 4,
        }}
      >
        <div
          data-tutorial-anchor="idle:stage"
          style={{
            ...outlined,
            fontSize: 18,
            padding: "3px 14px",
            borderRadius: 999,
            background: v.backdrop,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: v.gold }}>{t(info.difficulty)}</span>{" "}
          {info.chapter}-{info.stage}
          <span style={{ fontSize: 12, color: v.textDim }}>
            {" "}
            · {t(info.theme.id)}
          </span>
        </div>
        {snap.mode === "boss" ? (
          <BossBar
            timeLeft={snap.bossTimeLeft}
            hp={snap.bossHp}
            maxHp={snap.bossMaxHp}
          />
        ) : (
          <WavePips wave={snap.wave} waves={snap.waves} boss={snap.autoBoss} />
        )}
      </div>

      {snap.mode === "waves" && !snap.autoBoss && !snap.heroDown ? (
        <div
          style={{
            position: "absolute",
            top: "calc(10px + var(--idos-safe-top, 0px))",
            right: 10,
            pointerEvents: "auto",
          }}
        >
          <Button
            tone="red"
            size="sm"
            attract
            onClick={() => {
              if (session.battle.challengeBoss()) kit.play("notify");
            }}
            data-tutorial-anchor="idle:boss"
          >
            <Icon glyph="swords" size={18} /> {t("challenge")}
          </Button>
        </div>
      ) : null}

      {banner ? (
        <div
          key={banner.key}
          style={{
            position: "absolute",
            top: "38%",
            left: 0,
            right: 0,
            display: "grid",
            justifyItems: "center",
          }}
        >
          <div
            style={{
              ...outlined,
              ...toneSurface(banner.tone),
              fontSize: 22,
              padding: "6px 22px",
              borderRadius: 14,
              animation: `idos-pop-in ${v.slow} ease-out both`,
            }}
          >
            {banner.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WavePips({
  wave,
  waves,
  boss,
}: {
  wave: number;
  waves: number;
  boss: boolean;
}): ReactNode {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {Array.from({ length: waves }, (_, i) => (
        <span
          key={i}
          style={{
            width: 18,
            height: 8,
            borderRadius: 4,
            border: `2px solid ${v.backdrop}`,
            background: i < wave ? v.gold : i === wave ? v.green : v.well,
          }}
        />
      ))}
      <span style={{ opacity: boss ? 1 : 0.45 }}>
        <Icon glyph="crown" size={18} />
      </span>
    </div>
  );
}

function BossBar({
  timeLeft,
  hp,
  maxHp,
}: {
  timeLeft: number;
  hp: number;
  maxHp: number;
}): ReactNode {
  const share = maxHp > 0 ? hp / maxHp : 1;
  return (
    <div style={{ width: "min(320px, 100%)", display: "grid", gap: 3 }}>
      <div
        style={{
          ...outlined,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
        }}
      >
        <span>
          <Icon glyph="crown" size={14} /> {t("bossTime")}
        </span>
        <span style={{ color: timeLeft < 8 ? v.red : v.text }}>
          {Math.ceil(timeLeft)}s
        </span>
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 6,
          background: v.well,
          border: `2px solid ${v.backdrop}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(1, share)) * 100}%`,
            height: "100%",
            background: `linear-gradient(180deg, ${v.red}, ${v.redDeep})`,
            transition: `width ${v.fast} linear`,
          }}
        />
      </div>
      <div style={{ ...outlined, fontSize: 11, textAlign: "center" }}>
        {formatBig(Math.ceil(hp))} / {formatBig(Math.ceil(maxHp))}
      </div>
    </div>
  );
}

/** A short banner when the stage turns: cleared, boss, boss gone, hero down. */
function useBanner(session: IdleSession): Banner | null {
  const snap = session.battle.snapshot();
  const prev = useRef(snap);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const kit = useUiKit();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Compared on every render (the HUD redraws a few times a second): a turn shows once.
  useEffect(() => {
    const before = prev.current;
    prev.current = snap;
    let next: Omit<Banner, "key"> | null = null;
    if (snap.stage > before.stage) {
      next = { text: t("stageClear"), tone: "gold" };
      kit.play("levelUp");
    } else if (snap.mode === "boss" && before.mode !== "boss")
      next = { text: t("boss"), tone: "red" };
    else if (snap.heroDown && !before.heroDown)
      next = { text: t("heroDown"), tone: "blue" };
    else if (!snap.autoBoss && before.autoBoss && before.mode === "boss")
      next = { text: t("bossEscaped"), tone: "blue" };
    if (!next) return;
    setBanner({ ...next, key: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBanner(null), 1400);
  });

  return banner;
}
