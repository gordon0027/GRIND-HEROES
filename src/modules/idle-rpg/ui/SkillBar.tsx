import type { ReactNode } from "react";
import { Icon, outlined, useUiKit, v, type Glyph } from "@idosgames/react/ui";
import type { IdleSession } from "../game/session";
import type { SkillId } from "../game/battle";
import { t } from "../i18n";

// The skill row under the fight: three skills with a cooldown sweep and the "Auto" switch. With
// Auto on the battle casts them itself (Heal waits until the hero is hurt).

const GLYPH: Record<SkillId, Glyph> = {
  meteor: "flame",
  frenzy: "energy",
  heal: "heart",
};

export function SkillBar({ session }: { session: IdleSession }): ReactNode {
  const snap = session.battle.snapshot();
  const kit = useUiKit();
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        className="idos-press"
        data-tutorial-anchor="idle:auto"
        onClick={() => {
          kit.play("tab");
          session.battle.setAutoSkills(!snap.autoSkills);
        }}
        style={{
          ...outlined,
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: `3px solid ${snap.autoSkills ? v.gold : v.panelEdge}`,
          background: snap.autoSkills
            ? `linear-gradient(180deg, ${v.gold}, ${v.goldDeep})`
            : v.well,
          color: snap.autoSkills ? v.onGold : v.textDim,
          fontSize: 11,
          lineHeight: 1.05,
          cursor: "pointer",
        }}
      >
        {t("auto")}
        <br />
        {snap.autoSkills ? "ON" : "OFF"}
      </button>
      {snap.skills.map((s) => {
        const ready = s.unlocked && s.cooldownLeft <= 0 && !snap.heroDown;
        const sweep =
          s.cooldownLeft > 0 ? (s.cooldownLeft / s.cooldown) * 360 : 0;
        return (
          <button
            key={s.id}
            type="button"
            className="idos-press"
            title={t(s.id)}
            aria-label={t(s.id)}
            disabled={!ready}
            data-tutorial-anchor={`idle:skill:${s.id}`}
            onClick={() => {
              if (session.battle.castSkill(s.id)) kit.play("claim");
            }}
            style={{
              position: "relative",
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `3px solid ${s.activeLeft > 0 ? v.gold : v.panelEdge}`,
              background: v.panelDeep,
              display: "grid",
              placeItems: "center",
              cursor: ready ? "pointer" : "default",
              opacity: s.unlocked ? 1 : 0.55,
              overflow: "hidden",
              padding: 0,
            }}
          >
            <Icon glyph={s.unlocked ? GLYPH[s.id] : "lock"} size={26} />
            {sweep > 0 ? (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `conic-gradient(${v.backdrop} ${sweep}deg, transparent 0)`,
                }}
              />
            ) : null}
            {!s.unlocked ? (
              <span
                style={{
                  ...outlined,
                  position: "absolute",
                  bottom: 1,
                  fontSize: 9,
                }}
              >
                {t("opensAt")} {s.unlockStage}
              </span>
            ) : s.cooldownLeft > 0 ? (
              <span style={{ ...outlined, position: "absolute", fontSize: 13 }}>
                {Math.ceil(s.cooldownLeft)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
