import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Icon,
  ResourceCounter,
  buttonStyle,
  outlined,
  useCatalog,
  useUiKit,
  v,
  type Glyph,
} from "@idosgames/react/ui";
import type { HeroView, IdleSession } from "../game/session";
import {
  PERCENT_ROLES,
  enhanceValue,
  statCap,
  statCost,
  type Role,
  type StatInfo,
} from "../game/heroStats";
import { formatBig, formatStat } from "../game/format";
import { t } from "../i18n";

// "Enhance" — the stats of the fighting hero, bought with gold level by level (Legend Slime's main
// list). ×1 / ×10 / MAX sets how many levels one tap asks for; holding the button keeps buying. The
// session sends one request per stat at a time and adds the taps in between up — see IdleSession.enhance.

type Mult = 1 | 10 | "max";
const MAX_LEVELS = 1000;
const HOLD_START_MS = 380;
const HOLD_EVERY_MS = 140;

const ROLE_GLYPH: Record<Role, Glyph> = {
  damage: "sword",
  health: "heart",
  regen: "potion",
  armor: "shield",
  attackSpeed: "energy",
  critChance: "star",
  critDamage: "flame",
  dodge: "bulb",
  multiShot: "swords",
  allMight: "crown",
};

export function EnhancePanel({
  session,
  hero,
}: {
  session: IdleSession;
  hero: HeroView;
}): ReactNode {
  const [mult, setMult] = useState<Mult>(1);
  const catalog = useCatalog();
  const currency =
    session.income?.currencyID ??
    hero.stats.find((s) => s.price)?.price?.currencyID ??
    "";
  const rate = session.ratePerSecond();

  return (
    <div style={{ display: "grid", gap: 8, minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {currency ? (
            <ResourceCounter
              currencyID={currency}
              amount={session.balance(currency)}
              size={26}
            />
          ) : null}
          {rate > 0 ? (
            <span style={{ ...outlined, fontSize: 12, color: v.green }}>
              +{formatBig(Math.round(rate * 10) / 10)}
              {t("perSecond")}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {([1, 10, "max"] as Mult[]).map((m) => (
            <button
              key={String(m)}
              type="button"
              className="idos-press"
              onClick={() => setMult(m)}
              data-tutorial-anchor={`idle:mult:${m}`}
              style={{
                ...buttonStyle(mult === m ? "gold" : "grey", false, "sm"),
                padding: "4px 10px",
                minWidth: 44,
              }}
            >
              {m === "max" ? t("max") : `×${m}`}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          ...outlined,
          fontSize: 13,
          color: v.textDim,
        }}
      >
        <span style={{ color: v.text, fontSize: 15 }}>
          {catalog.localize(hero.name)}
        </span>
        <span>
          {t("rank")} {hero.rank}
        </span>
        <span>
          {t("power")} {formatBig(hero.power)}
        </span>
      </div>
      <Rows session={session} hero={hero} mult={mult} />
    </div>
  );
}

// The rows redraw when the hero changes (an upgrade, gear, the balance) — not with the fight.
const Rows = memo(function Rows({
  session,
  hero,
  mult,
}: {
  session: IdleSession;
  hero: HeroView;
  mult: Mult;
}): ReactNode {
  const stats = hero.stats.filter((s) => s.price);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {stats.map((stat) => (
        <StatRow
          key={stat.id}
          session={session}
          hero={hero}
          stat={stat}
          mult={mult}
        />
      ))}
    </div>
  );
});

function StatRow({
  session,
  hero,
  stat,
  mult,
}: {
  session: IdleSession;
  hero: HeroView;
  stat: StatInfo;
  mult: Mult;
}): ReactNode {
  const catalog = useCatalog();
  const level = Number(hero.input.model?.StatLevels?.[stat.id] ?? 0);
  const cap = statCap(stat, Math.max(1, hero.rank), hero.def);
  const capped = cap > 0 && level >= cap;
  const want = mult === "max" ? MAX_LEVELS : mult;
  const plan = session.plan(stat.id, want);
  const levels = plan.levels;
  const percent = stat.role ? PERCENT_ROLES.has(stat.role) : false;
  const value = enhanceValue(hero.input, stat.id, level);
  const next = enhanceValue(hero.input, stat.id, level + Math.max(1, levels));
  const missing = stat.requirements.filter(
    (r) => Number(hero.input.model?.StatLevels?.[r.statID] ?? 0) < r.level,
  );
  const blocked = capped || missing.length > 0;
  const can = !blocked && levels > 0;
  const cost = levels > 0 ? plan.cost : statCost(stat, level + 1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px",
        borderRadius: 12,
        background: v.panel,
        border: `2px solid ${v.panelEdge}`,
        boxShadow: v.panelShadow,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          flex: "0 0 46px",
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: v.wellSoft,
          border: `2px solid ${v.panelEdge}`,
          position: "relative",
        }}
      >
        <Icon glyph={stat.role ? ROLE_GLYPH[stat.role] : "star"} size={28} />
        <span
          style={{
            ...outlined,
            position: "absolute",
            bottom: -6,
            fontSize: 10,
            padding: "0 4px",
            borderRadius: 6,
            background: v.panelDeep,
          }}
        >
          Lv {formatBig(level)}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...outlined, fontSize: 14 }}>
          {catalog.localize(stat.name)}
        </div>
        <div style={{ ...outlined, fontSize: 15, color: v.gold }}>
          {formatStat(value, percent)}
          {!blocked && levels > 0 ? (
            <span style={{ fontSize: 11, color: v.green }}>
              {" "}
              → {formatStat(next, percent)}
            </span>
          ) : null}
        </div>
        {cap > 0 ? (
          <div style={{ ...outlined, fontSize: 10, color: v.textDim }}>
            {level}/{cap}
            {capped ? ` · ${t("rankUpToRaise")}` : ""}
            {missing.length > 0
              ? ` · ${t("needs")}: ${missing.map((m) => `${m.statID} ${m.level}`).join(", ")}`
              : ""}
          </div>
        ) : null}
      </div>
      <HoldButton
        disabled={!can}
        repeat={mult !== "max"}
        onPress={() => session.enhance(stat.id, levels > 0 ? levels : 1)}
        anchor={`idle:enhance:${stat.id}`}
      >
        {capped ? (
          t("maxed")
        ) : (
          <span
            style={{ display: "grid", justifyItems: "center", lineHeight: 1.1 }}
          >
            <span style={{ fontSize: 13 }}>
              {t("enhance")}
              {levels > 1 ? ` ×${levels}` : ""}
            </span>
            {stat.price ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 12,
                }}
              >
                <Icon
                  glyph={catalog.iconOf({
                    kind: "currency",
                    id: stat.price.currencyID,
                    amount: cost,
                  })}
                  size={14}
                />
                {formatBig(cost)}
              </span>
            ) : null}
          </span>
        )}
      </HoldButton>
    </div>
  );
}

/** A button that fires on press and keeps firing while held (after a short pause). */
function HoldButton({
  children,
  disabled,
  repeat,
  onPress,
  anchor,
}: {
  children: ReactNode;
  disabled: boolean;
  repeat: boolean;
  onPress: () => void;
  anchor: string;
}): ReactNode {
  const kit = useUiKit();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef(onPress);
  press.current = onPress;
  const live = useRef(!disabled);
  live.current = !disabled;

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  const loop = () => {
    timer.current = setTimeout(() => {
      if (!live.current) return stop();
      press.current();
      loop();
    }, HOLD_EVERY_MS);
  };

  return (
    <button
      type="button"
      className="idos-press"
      disabled={disabled}
      data-tutorial-anchor={anchor}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        kit.play("click");
        press.current();
        if (!repeat) return;
        stop();
        timer.current = setTimeout(loop, HOLD_START_MS);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        ...buttonStyle("green", disabled, "sm"),
        minWidth: 104,
        minHeight: 46,
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {children}
    </button>
  );
}
