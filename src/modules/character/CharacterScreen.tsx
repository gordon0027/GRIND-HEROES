import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  ItemTile,
  Popup,
  ProgressBar,
  ResourceList,
  SectionTitle,
  Tabs,
  canAfford,
  configSection,
  costLines,
  errorText,
  formatAmount,
  outlined,
  panel,
  useCatalog,
  useGameLayout,
  usePopupClose,
  useSound,
  useStagger,
  useToast,
  useUiKit,
  v,
  type ResourceLine,
} from "@idosgames/react/ui";
import {
  SKIN_KEY,
  bestLoadout,
  breakdown,
  fitProblem,
  gearPieces,
  itemLevelCost,
  pieceBonuses,
  rankCost,
  resolveLadder,
  resolveSlots,
  resolveStats,
  roster,
  statCost,
  statMaxLevel,
  statNumber,
  unequipAllSlots,
  unmetRequirements,
  upgradeAllPlan,
  type CharacterModelView,
  type CharacterSection,
  type GearPiece,
  type InstanceView,
  type ItemDefWithGear,
  type RosterEntry,
  type SlotView,
  type StatView,
} from "./model";
import { t } from "./i18n";
import { readSelected, resolveSelected, saveSelected } from "./selection";

// Heroes (Unity: the Hero button → CharacterListPanel, CharacterDetailPanel, EquipmentPanel). The
// screen is the equipment hub of the selected hero — portrait, rank and Power, the slots, "Equip
// best", and the gear the player owns. Everything with more data opens as a popup: the hero list
// (select / unlock), the stats (upgrade, and "where does this number come from"), a piece of gear
// (equip / take off / level up), a slot's fitting gear, and skins.

/**
 * `onSelect` — the player picked a hero to play with; the module turns it into the
 * `character:hero-selected@1` event for the game.
 */
export function makeCharacterScreen(
  features: FeatureRegistry,
  onSelect: (characterId: string) => void,
) {
  return function CharacterScreen({ args }: FeatureScreenProps): ReactNode {
    return (
      <Heroes
        features={features}
        onSelect={onSelect}
        rankOnly={args?.rankOnly === true}
        openInstance={
          typeof args?.itemInstanceID === "string" ? args.itemInstanceID : null
        }
      />
    );
  };
}

type PopupState =
  | { kind: "heroes" }
  | { kind: "stats" }
  | { kind: "skins" }
  | { kind: "slot"; slot: SlotView }
  | { kind: "piece"; instanceID: string }
  | null;

function HeroPortrait({ source, size }: { source?: string; size: number }): ReactNode {
  if (source && /^(https?:\/\/|\/)/.test(source)) {
    return (
      <img
        src={source}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: "contain", imageRendering: "pixelated" }}
      />
    );
  }
  return <Icon glyph={source ?? "hero"} size={size} />;
}

function useData() {
  const client = useIDosGamesClient();
  const state = useUserState();
  const catalog = useCatalog();
  // Definitions arrive with the title config; a title whose config did not carry them fetches them
  // once — and the screen redraws when they land (the section cache emits no user-state event).
  const [, loaded] = useState(0);
  const section = configSection<CharacterSection>(client, "Character");
  useEffect(() => {
    if (!section)
      void client.character
        .getCharacterDefinitions()
        .then(() => loaded((n) => n + 1));
    // Heroes and gear (with their instances) are in the login state and every reply keeps them
    // fresh. Opening the screen re-checks them against changes made elsewhere (another device) —
    // through the central cache: nothing at all while they were confirmed a minute ago.
    void client.cache.ensureState(["Character", "InventoryV2"], {
      maxAgeMs: 60_000,
    });
  }, [client, section]);
  const owned = (state?.Character?.Characters ?? {}) as Record<
    string,
    CharacterModelView
  >;
  const inventory = state?.InventoryV2 as
    | {
        UnstackableItems?: Record<string, InstanceView | null>;
        VirtualCurrencies?: Record<string, { Amount?: number }>;
      }
    | undefined;
  const items = catalog.items as Map<string, ItemDefWithGear>;
  // Not memoized: the SDK cache updates UnstackableItems IN PLACE (an equip flips EquippedSlot on
  // the same object), so a memo keyed by the object would keep showing the old state.
  const pieces = gearPieces(inventory?.UnstackableItems, items);
  return {
    client,
    section,
    owned,
    inventory,
    items,
    pieces,
    balances: inventory?.VirtualCurrencies,
  };
}

function Heroes({
  features,
  onSelect,
  openInstance,
  rankOnly,
}: {
  features: FeatureRegistry;
  onSelect: (characterId: string) => void;
  openInstance: string | null;
  rankOnly: boolean;
}): ReactNode {
  const { client, section, owned, items, pieces, balances } = useData();
  const catalog = useCatalog();
  const layout = useGameLayout();
  const toast = useToast();
  const kit = useUiKit();
  const cardRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupState>(
    openInstance ? { kind: "piece", instanceID: openInstance } : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedID, setSelectedID] = useState<string | null>(readSelected);

  const list = roster(section, owned).filter((entry) => entry.state !== "locked");
  if (list.length === 0)
    return <EmptyState glyph="hero" text={t("noHeroes")} />;
  const hero = resolveSelected(list, selectedID)!;
  const select = (id: string) => {
    setSelectedID(id);
    saveSelected(id);
    onSelect(id);
  };

  const ladder = resolveLadder(section, hero.def);
  const nextRank = rankCost(ladder, hero.rank);
  const slots = resolveSlots(section, hero.def);
  const changes =
    hero.state === "locked"
      ? []
      : bestLoadout(
          hero.id,
          hero.rank,
          slots,
          pieces,
          hero.model?.Equipment,
          items,
        );
  const rarity = catalog.rarityColor(hero.def.Classification?.RarityID);
  const heroName = catalog.localize(hero.def.Identity?.DisplayName ?? hero.id);
  const skinCount = Object.keys(hero.def.Skins?.Definitions ?? {}).length;

  const rankUp = async () => {
    setBusy("rank");
    const res = await client.character.upgradeCharacterLevel(hero.id);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    kit.play("levelUp");
    kit.fx.burst(cardRef.current);
  };

  const equipBest = async () => {
    setBusy("best");
    const res = await client.character.equipItems(hero.id, changes);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    kit.play("claim");
    kit.fx.burst(cardRef.current);
  };

  // Always enabled (Unity EquipmentPanel.OnUnequipAllClicked): it is the way out of a local/server
  // mismatch, and a mismatch looks exactly like "nothing is worn here". The server empties only what
  // it has; the hero and the gear are re-read afterwards either way — the player pressed it because
  // what they see is not what they expect.
  const unequipAll = async () => {
    setBusy("off");
    const slotIDs = unequipAllSlots(
      hero.id,
      slots,
      hero.model?.Equipment,
      pieces,
    );
    const res =
      slotIDs.length > 0
        ? await client.character.unequipItems(hero.id, slotIDs)
        : null;
    await client.cache.ensureState(["Character", "InventoryV2"], {
      force: true,
    });
    setBusy(null);
    if (res && !res.ok) return toast(errorText(res.error), "error");
    kit.play("click");
  };

  const card = (
    <div
      ref={cardRef}
      className="idos-shine"
      style={{
        ...panel,
        padding: 16,
        display: "grid",
        gap: 10,
        justifyItems: "center",
        background: `radial-gradient(circle at 50% 30%, ${rarity}55 0%, ${v.panelDeep} 75%)`,
        border: `2px solid ${rarity}`,
      }}
    >
      <div
        className="idos-bounce"
        style={{
          width: 110,
          height: 110,
          borderRadius: 28,
          display: "grid",
          placeItems: "center",
          background: v.wellSoft,
          border: `3px solid ${rarity}`,
        }}
      >
        <HeroPortrait
          source={
            hero.def.Identity?.AssetPaths?.portrait ??
            hero.def.Identity?.AssetPaths?.icon
          }
          size={80}
        />
      </div>
      <div style={{ ...outlined, fontSize: 22 }}>{heroName}</div>
      {hero.def.Classification?.ClassID ? (
        <div style={{ ...outlined, fontSize: 12, color: rarity }}>
          {hero.def.Classification.ClassID} · {hero.def.Classification.RarityID}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 18 }}>
        <Stat
          label={t("rank")}
          value={`${hero.rank}${ladder?.MaxRank ? ` / ${ladder.MaxRank}` : ""}`}
        />
        <Stat label={t("power")} value={formatAmount(hero.power)} />
      </div>
      {hero.state === "locked" ? null : nextRank === null ? (
        <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
          {t("maxRank")}
        </div>
      ) : (
        <Button
          tone="gold"
          attract={canAfford(nextRank, balances)}
          disabled={!canAfford(nextRank, balances)}
          busy={busy === "rank"}
          onClick={() => void rankUp()}
          data-tutorial-anchor="heroes:rank-up"
        >
          {t("rankUp")}{" "}
          {nextRank.length ? (
            <ResourceList
              lines={nextRank}
              size={18}
              dimIf={() => !canAfford(nextRank, balances)}
            />
          ) : (
            t("free")
          )}
        </Button>
      )}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span style={{ position: "relative" }}>
          <Button
            tone="blue"
            size="sm"
            onClick={() => setPopup({ kind: "heroes" })}
          >
            <Icon glyph="friends" size={18} /> {t("heroes")}
          </Button>
        </span>
        {hero.state !== "locked" ? (
          <Button
            tone="blue"
            size="sm"
            onClick={() => setPopup({ kind: "stats" })}
          >
            <Icon glyph="sword" size={18} /> {t("stats")}
          </Button>
        ) : null}
        {skinCount > 0 && hero.state !== "locked" ? (
          <Button
            tone="blue"
            size="sm"
            onClick={() => setPopup({ kind: "skins" })}
          >
            <Icon glyph="user" size={18} /> {t("skins")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  const equipment = (
    <div style={{ display: "grid", gap: 14 }}>
      <SectionTitle
        right={
          hero.state === "locked" ? null : (
            <span style={{ display: "flex", gap: 6 }}>
              <Button
                tone="blue"
                size="sm"
                busy={busy === "off"}
                onClick={() => void unequipAll()}
              >
                {t("unequipAll")}
              </Button>
              {changes.length > 0 ? (
                <Button
                  tone="green"
                  size="sm"
                  attract
                  busy={busy === "best"}
                  onClick={() => void equipBest()}
                  data-tutorial-anchor="heroes:equip-best"
                >
                  {t("equipBest")}
                </Button>
              ) : null}
            </span>
          )
        }
      >
        {t("equipment")}
      </SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${layout === "phone" ? 88 : 104}px, 1fr))`,
          gap: 12,
          justifyItems: "center",
        }}
      >
        {slots.map((slot) => (
          <SlotTile
            key={slot.id}
            slot={slot}
            hero={hero}
            pieces={pieces}
            onClick={() => setPopup({ kind: "slot", slot })}
          />
        ))}
      </div>
      <Bag
        pieces={pieces.filter((p) => !p.equippedBy)}
        onPick={(id) => setPopup({ kind: "piece", instanceID: id })}
        onShop={
          features.get("store") ? () => features.open("store") : undefined
        }
      />
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {rankOnly ? card : layout === "desktop" ? (
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "minmax(0, 4fr) minmax(0, 6fr)",
            alignItems: "start",
          }}
        >
          {card}
          {equipment}
        </div>
      ) : (
        <>
          {card}
          {equipment}
        </>
      )}
      {popup?.kind === "heroes" ? (
        <HeroesPopup
          list={list}
          current={hero.id}
          onSelect={select}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {popup?.kind === "stats" ? (
        <StatsPopup
          hero={hero}
          section={section}
          pieces={pieces}
          items={items}
          balances={balances}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {popup?.kind === "skins" ? (
        <SkinsPopup hero={hero} onClose={() => setPopup(null)} />
      ) : null}
      {popup?.kind === "slot" ? (
        <SlotPopup
          slot={popup.slot}
          hero={hero}
          pieces={pieces}
          items={items}
          onPick={(id) => setPopup({ kind: "piece", instanceID: id })}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {popup?.kind === "piece" ? (
        <PiecePopup
          instanceID={popup.instanceID}
          hero={hero}
          slots={slots}
          pieces={pieces}
          items={items}
          balances={balances}
          onClose={() => setPopup(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div style={{ display: "grid", justifyItems: "center" }}>
      <span style={{ ...outlined, fontSize: 12, color: v.textDim }}>
        {label}
      </span>
      <span style={{ ...outlined, fontSize: 20, color: v.gold }}>{value}</span>
    </div>
  );
}

function SlotTile({
  slot,
  hero,
  pieces,
  onClick,
}: {
  slot: SlotView;
  hero: RosterEntry;
  pieces: GearPiece[];
  onClick: () => void;
}): ReactNode {
  const worn = hero.model?.Equipment?.[slot.id];
  const piece = worn?.ItemInstanceID
    ? pieces.find((p) => p.instanceID === worn.ItemInstanceID)
    : undefined;
  const locked = hero.rank < slot.minRank;
  const { play } = useUiKit();
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
      {worn?.ItemID ? (
        <ItemTile
          itemID={worn.ItemID}
          level={piece?.level}
          onClick={onClick}
          size={80}
        />
      ) : (
        <button
          type="button"
          className="idos-press"
          onClick={() => {
            play("click");
            onClick();
          }}
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            border: `3px dashed ${v.panelEdge}`,
            background: v.wellSoft,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            opacity: locked ? 0.5 : 1,
          }}
        >
          <Icon glyph={locked ? "lock" : "plus"} size={30} />
        </button>
      )}
      <span style={{ ...outlined, fontSize: 12, color: v.textDim }}>
        {locked ? `${t("slotLocked")} ${slot.minRank}` : slot.id}
      </span>
    </div>
  );
}

function Bag({
  pieces,
  onPick,
  onShop,
}: {
  pieces: GearPiece[];
  onPick: (instanceID: string) => void;
  onShop?: () => void;
}): ReactNode {
  const catalog = useCatalog();
  const stagger = useStagger();
  const classes = [
    ...new Set(
      pieces.map((p) => catalog.items.get(p.itemID)?.ItemClass || "other"),
    ),
  ];
  const [tab, setTab] = useState("all");
  const shown =
    tab === "all"
      ? pieces
      : pieces.filter(
          (p) => (catalog.items.get(p.itemID)?.ItemClass || "other") === tab,
        );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <SectionTitle>{t("bag")}</SectionTitle>
      {pieces.length === 0 ? (
        <EmptyState
          glyph="sword"
          text={t("noGear")}
          action={
            onShop ? (
              <Button onClick={onShop}>{catalog.localize("Shop")}</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Tabs
            tabs={[
              { id: "all", label: "★" },
              ...classes.map((c) => ({ id: c, label: c })),
            ]}
            value={tab}
            onChange={setTab}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
              gap: 10,
              justifyItems: "center",
            }}
          >
            {shown.map((p, i) => (
              <div key={p.instanceID} style={stagger(i)}>
                <ItemTile
                  itemID={p.itemID}
                  level={p.level}
                  onClick={() => onPick(p.instanceID)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Popups ───────────────────────────────────────────────────────────────────────────────────

function HeroesPopup({
  list,
  current,
  onSelect,
  onClose,
}: {
  list: RosterEntry[];
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}): ReactNode {
  const catalog = useCatalog();
  const stagger = useStagger();

  return (
    <Popup title={t("heroes")} onClose={onClose} width={560}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {list.map((e, i) => {
          const color = catalog.rarityColor(e.def.Classification?.RarityID);
          return (
            <Card
              key={e.id}
              highlight={e.id === current}
              style={{
                display: "grid",
                justifyItems: "center",
                gap: 6,
                border: `2px solid ${e.id === current ? v.gold : color}`,
                ...stagger(i),
              }}
            >
              <div style={{ position: "relative" }}>
                <HeroPortrait source={e.def.Identity?.AssetPaths?.icon} size={56} />
              </div>
              <div style={{ ...outlined, fontSize: 15 }}>
                {catalog.localize(e.def.Identity?.DisplayName ?? e.id)}
              </div>
              <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                {t("rank")} {e.rank} · {t("power")} {formatAmount(e.power)}
              </div>
              {e.id === current ? (
                <span style={{ ...outlined, fontSize: 13, color: v.gold }}>
                  {t("selected")}
                </span>
              ) : (
                <SelectButton onSelect={() => onSelect(e.id)} />
              )}
            </Card>
          );
        })}
      </div>
    </Popup>
  );
}

function SelectButton({ onSelect }: { onSelect: () => void }): ReactNode {
  const close = usePopupClose();
  return (
    <Button
      size="sm"
      onClick={() => {
        onSelect();
        close();
      }}
      style={{ width: "100%" }}
    >
      {t("select")}
    </Button>
  );
}

function StatsPopup({
  hero,
  section,
  pieces,
  items,
  balances,
  onClose,
}: {
  hero: RosterEntry;
  section: CharacterSection | undefined;
  pieces: GearPiece[];
  items: Map<string, ItemDefWithGear>;
  balances: Record<string, { Amount?: number }> | undefined;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const toast = useToast();
  const play = useSound();
  const stagger = useStagger();
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<StatView | null>(null);
  const stats = resolveStats(section, hero.def);
  const levels = hero.model?.StatLevels ?? {};
  const worn = Object.values(hero.model?.Equipment ?? {})
    .filter((e) => e?.ItemInstanceID)
    .map((e) => {
      const p = pieces.find((x) => x.instanceID === e!.ItemInstanceID);
      return { def: items.get(e!.ItemID ?? ""), level: p?.level ?? 1 };
    });

  const upgrade = async (stat: StatView) => {
    setBusy(stat.id);
    const res = await client.character.upgradeStatLevel(hero.id, stat.id);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    play("levelUp");
  };

  // "Upgrade all" (Unity CharacterStatPopup): as many levels as the balances cover, spread over the
  // stats cheapest-first, in ONE atomic batch.
  const plan = upgradeAllPlan(stats, levels, hero.rank, hero.def, balances);
  const upgradeAll = async () => {
    setBusy("all");
    const res = await client.character.upgradeStatLevelsBatch(
      plan.map((p) => ({ CharacterID: hero.id, ...p })),
    );
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    play("levelUp");
  };

  return (
    <Popup
      title={`${t("stats")} · ${catalog.localize(hero.def.Identity?.DisplayName ?? hero.id)}`}
      onClose={onClose}
      width={480}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <Button
          tone="gold"
          attract={plan.length > 0}
          disabled={plan.length === 0}
          busy={busy === "all"}
          onClick={() => void upgradeAll()}
        >
          {t("upgradeAll")}
          {plan.length > 0 ? ` +${plan.reduce((n, p) => n + p.Levels, 0)}` : ""}
        </Button>
        {stats.map((stat, i) => {
          const level = Number(levels[stat.id] ?? 0);
          const cap = statMaxLevel(stat, hero.rank, hero.def);
          const capped = cap > 0 && level >= cap;
          const cost = statCost(stat, level + 1);
          const missing = unmetRequirements(stat, levels);
          const affordable = canAfford(cost, balances);
          const total = breakdown(stat, level, hero.rank, hero.def, worn).total;
          return (
            <Card
              key={stat.id}
              style={{ display: "grid", gap: 8, ...stagger(i) }}
            >
              <button
                type="button"
                onClick={() => setDetail(stat)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: v.text,
                }}
              >
                <span style={{ ...outlined, fontSize: 15 }}>
                  {catalog.localize(stat.name)} ⓘ
                </span>
                <span style={{ ...outlined, fontSize: 18, color: v.gold }}>
                  {statNumber(total)}
                </span>
              </button>
              {cap > 0 ? (
                <ProgressBar
                  value={level}
                  max={cap}
                  label={`${t("level")} ${level} / ${cap}`}
                  height={16}
                />
              ) : null}
              {missing.length > 0 ? (
                <div style={{ ...outlined, fontSize: 12, color: v.red }}>
                  {t("needs")}:{" "}
                  {missing.map((m) => `${m.statID} ${m.level}`).join(", ")}
                </div>
              ) : capped ? (
                <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                  {t("statCapped")}
                </div>
              ) : (
                <Button
                  size="sm"
                  tone="green"
                  disabled={!affordable}
                  busy={busy === stat.id}
                  onClick={() => void upgrade(stat)}
                >
                  {t("upgrade")} →{" "}
                  {statNumber(
                    breakdown(stat, level + 1, hero.rank, hero.def, worn).total,
                  )}{" "}
                  <ResourceList
                    lines={cost}
                    size={16}
                    dimIf={() => !affordable}
                  />
                </Button>
              )}
            </Card>
          );
        })}
      </div>
      {detail ? (
        <BreakdownPopup
          stat={detail}
          level={Number(levels[detail.id] ?? 0)}
          hero={hero}
          worn={worn}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </Popup>
  );
}

function BreakdownPopup({
  stat,
  level,
  hero,
  worn,
  onClose,
}: {
  stat: StatView;
  level: number;
  hero: RosterEntry;
  worn: Array<{ def: ItemDefWithGear | undefined; level: number }>;
  onClose: () => void;
}): ReactNode {
  const catalog = useCatalog();
  const b = breakdown(stat, level, hero.rank, hero.def, worn);
  const rows: Array<[string, number, string]> = [
    [t("base"), b.base, v.text],
    [t("fromLevel"), b.fromLevel, v.green],
    [t("fromRank"), b.fromRank, v.blue],
    [t("fromGear"), b.fromGear, v.gold],
  ];
  const round = statNumber;
  return (
    <Popup
      title={`${catalog.localize(stat.name)} — ${t("where")}`}
      onClose={onClose}
      width={380}
      variant="center"
    >
      {stat.description ? (
        <div
          style={{
            ...outlined,
            fontWeight: 600,
            fontSize: 13,
            color: v.textDim,
            textAlign: "center",
          }}
        >
          {catalog.localize(stat.description)}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 6 }}>
        {rows.map(([label, value, color]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              ...outlined,
              fontSize: 15,
            }}
          >
            <span style={{ color: v.textDim }}>{label}</span>
            <span style={{ color }}>
              {value === 0 && label !== t("base")
                ? "—"
                : `${label === t("base") ? "" : "+"}${round(value)}`}
            </span>
          </div>
        ))}
        {b.percent ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              ...outlined,
              fontSize: 15,
            }}
          >
            <span style={{ color: v.textDim }}>{t("percent")}</span>
            <span style={{ color: v.gold }}>+{round(b.percent)}%</span>
          </div>
        ) : null}
        <div style={{ height: 2, background: v.panelEdge, margin: "4px 0" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            ...outlined,
            fontSize: 18,
          }}
        >
          <span>{t("total")}</span>
          <span style={{ color: v.gold }}>{round(b.total)}</span>
        </div>
      </div>
    </Popup>
  );
}

function SlotPopup({
  slot,
  hero,
  pieces,
  items,
  onPick,
  onClose,
}: {
  slot: SlotView;
  hero: RosterEntry;
  pieces: GearPiece[];
  items: Map<string, ItemDefWithGear>;
  onPick: (instanceID: string) => void;
  onClose: () => void;
}): ReactNode {
  const worn = hero.model?.Equipment?.[slot.id]?.ItemInstanceID ?? null;
  const fitting = pieces.filter(
    (p) =>
      p.instanceID !== worn &&
      (!p.equippedBy || p.equippedBy.characterID === hero.id) &&
      fitProblem(p, slot, hero.id, hero.rank, items) === null,
  );
  const stagger = useStagger();
  return (
    <Popup title={slot.id} onClose={onClose} width={440}>
      {worn ? (
        <PickRow
          instanceID={worn}
          pieces={pieces}
          label={t("worn")}
          onPick={onPick}
        />
      ) : null}
      {fitting.length === 0 ? (
        <EmptyState
          glyph="sword"
          text={
            hero.rank < slot.minRank
              ? `${t("slotLocked")} ${slot.minRank}`
              : t("noGear")
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
            {t("fits")}
          </div>
          {fitting.map((p, i) => (
            <div key={p.instanceID} style={stagger(i)}>
              <PickRow
                instanceID={p.instanceID}
                pieces={pieces}
                onPick={onPick}
              />
            </div>
          ))}
        </div>
      )}
    </Popup>
  );
}

function PickRow({
  instanceID,
  pieces,
  label,
  onPick,
}: {
  instanceID: string;
  pieces: GearPiece[];
  label?: string;
  onPick: (id: string) => void;
}): ReactNode {
  const catalog = useCatalog();
  const piece = pieces.find((p) => p.instanceID === instanceID);
  if (!piece) return null;
  return (
    <Card
      onClick={() => onPick(instanceID)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: 10 }}
    >
      <ItemTile itemID={piece.itemID} level={piece.level} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...outlined, fontSize: 15 }}>
          {catalog.itemName(piece.itemID)}
        </div>
        <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
          {label ? `${label} · ` : ""}
          {t("level")} {piece.level}
        </div>
      </div>
    </Card>
  );
}

function PiecePopup({
  instanceID,
  hero,
  slots,
  pieces,
  items,
  balances,
  onClose,
}: {
  instanceID: string;
  hero: RosterEntry;
  slots: SlotView[];
  pieces: GearPiece[];
  items: Map<string, ItemDefWithGear>;
  balances: Record<string, { Amount?: number }> | undefined;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const toast = useToast();
  const kit = useUiKit();
  const iconRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const piece = pieces.find((p) => p.instanceID === instanceID);
  if (!piece) return null;
  const def = items.get(piece.itemID);
  const color = catalog.rarityColor(def?.Metadata?.RarityID);
  const bonuses = pieceBonuses(def, piece.level);
  const fitSlot = slots.find(
    (s) => fitProblem(piece, s, hero.id, hero.rank, items) === null,
  );
  const onThisHero =
    piece.equippedBy?.characterID === hero.id ? piece.equippedBy : null;
  const levelCost = itemLevelCost(def, piece.level);
  const affordable = levelCost
    ? canAfford(levelCost as ResourceLine[], balances)
    : false;

  const act = async (kind: "equip" | "unequip" | "level") => {
    setBusy(kind);
    const res =
      kind === "equip" && fitSlot
        ? await client.character.equipItems(hero.id, [
            { SlotID: fitSlot.id, ItemInstanceID: piece.instanceID },
          ])
        : kind === "unequip" && onThisHero
          ? await client.character.unequipItems(hero.id, [onThisHero.slotID])
          : await client.item.upgradeLevel(piece.instanceID);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    kit.play(kind === "level" ? "levelUp" : "claim");
    kit.fx.burst(iconRef.current);
  };

  return (
    <Popup title={catalog.itemName(piece.itemID)} onClose={onClose}>
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <div
          ref={iconRef}
          className="idos-glow"
          style={{
            width: 110,
            height: 110,
            borderRadius: 26,
            display: "grid",
            placeItems: "center",
            border: `4px solid ${color}`,
            background: `radial-gradient(circle at 50% 35%, ${color}66 0%, ${v.panelDeep} 72%)`,
          }}
        >
          <Icon
            glyph={catalog.iconOf({
              kind: "item",
              id: piece.itemID,
              amount: 1,
            })}
            size={72}
          />
        </div>
        <div style={{ ...outlined, color, fontSize: 14 }}>
          {def?.Metadata?.RarityID ?? "Common"} · {t("level")} {piece.level}
          {def?.Upgrade?.MaxLevel ? ` / ${def.Upgrade.MaxLevel}` : ""}
        </div>
        {Object.entries(bonuses).map(([stat, value]) => (
          <div key={stat} style={{ ...outlined, fontSize: 15, color: v.green }}>
            +{statNumber(value)} {stat}
          </div>
        ))}
        {Object.entries(def?.Stats?.PercentBonuses ?? {}).map(
          ([stat, value]) => (
            <div
              key={stat}
              style={{ ...outlined, fontSize: 15, color: v.gold }}
            >
              +{value}% {stat}
            </div>
          ),
        )}
        {piece.equippedBy && !onThisHero ? (
          <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
            {t("wornBy")} {piece.equippedBy.characterID}
          </div>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {onThisHero ? (
          <Button
            tone="grey"
            busy={busy === "unequip"}
            onClick={() => void act("unequip")}
          >
            {t("unequip")}
          </Button>
        ) : fitSlot ? (
          <Button
            tone="blue"
            busy={busy === "equip"}
            onClick={() => void act("equip")}
          >
            {t("equip")} → {fitSlot.id}
          </Button>
        ) : (
          <div
            style={{
              ...outlined,
              fontSize: 13,
              color: v.textDim,
              textAlign: "center",
            }}
          >
            {t("cannot")}
          </div>
        )}
        {levelCost === null ? (
          def?.Upgrade ? (
            <div
              style={{
                ...outlined,
                fontSize: 13,
                color: v.textDim,
                textAlign: "center",
              }}
            >
              {t("maxLevel")}
            </div>
          ) : null
        ) : (
          <Button
            tone="gold"
            disabled={!affordable}
            busy={busy === "level"}
            onClick={() => void act("level")}
          >
            {t("levelUp")}{" "}
            <ResourceList
              lines={levelCost}
              size={18}
              dimIf={() => !affordable}
            />
          </Button>
        )}
      </div>
    </Popup>
  );
}

function SkinsPopup({
  hero,
  onClose,
}: {
  hero: RosterEntry;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const toast = useToast();
  const kit = useUiKit();
  const stagger = useStagger();
  const [view, setView] = useState<{
    WornSkinID?: string | null;
    Skins?: Array<{
      SkinID: string;
      Owned?: boolean | null;
      IsWorn?: boolean | null;
      Purchasable?: boolean | null;
      MeetsRequirements?: boolean | null;
      PriceOptions?: Record<string, { Cost?: unknown }> | null;
    }> | null;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const res = await client.character.getCharacterSkins(hero.id);
    if (res.ok) setView(res.data.Characters?.[hero.id] ?? null);
  };
  useEffect(() => {
    void load();
    // once per hero
  }, [hero.id]);

  const act = async (skinID: string, kind: "wear" | "buy" | "base") => {
    setBusy(skinID);
    const res =
      kind === "buy"
        ? await client.character.unlockSkin(hero.id, skinID, {
            autoEquip: true,
          })
        : kind === "base"
          ? await client.character.unequipSkin(hero.id)
          : await client.character.equipSkin(hero.id, skinID);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    kit.play(kind === "buy" ? "purchase" : "claim");
    await load();
  };

  const defs = hero.def.Skins?.Definitions ?? {};
  const wornID = hero.model?.Equipment?.[SKIN_KEY]?.ItemID ?? null;
  return (
    <Popup title={t("skins")} onClose={onClose} width={520}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <Card
          highlight={!wornID}
          style={{ display: "grid", justifyItems: "center", gap: 6 }}
        >
          <Icon glyph="hero" size={52} />
          <div style={{ ...outlined, fontSize: 14 }}>{t("baseLook")}</div>
          {wornID ? (
            <Button
              size="sm"
              busy={busy === "@base"}
              onClick={() => void act("@base", "base")}
            >
              {t("wear")}
            </Button>
          ) : (
            <span style={{ ...outlined, fontSize: 13, color: v.gold }}>
              {t("worn")}
            </span>
          )}
        </Card>
        {(view?.Skins ?? []).map((s, i) => {
          const def = defs[s.SkinID];
          const price = Object.values(s.PriceOptions ?? {})[0];
          return (
            <Card
              key={s.SkinID}
              highlight={s.IsWorn === true}
              style={{
                display: "grid",
                justifyItems: "center",
                gap: 6,
                ...stagger(i),
              }}
            >
              <Icon
                glyph={def?.Identity?.AssetPaths?.icon ?? "user"}
                size={52}
              />
              <div style={{ ...outlined, fontSize: 14 }}>
                {catalog.localize(def?.Identity?.DisplayName ?? s.SkinID)}
              </div>
              {s.IsWorn ? (
                <span style={{ ...outlined, fontSize: 13, color: v.gold }}>
                  {t("worn")}
                </span>
              ) : s.Owned ? (
                <Button
                  size="sm"
                  disabled={s.MeetsRequirements === false}
                  busy={busy === s.SkinID}
                  onClick={() => void act(s.SkinID, "wear")}
                >
                  {t("wear")}
                </Button>
              ) : s.Purchasable && price ? (
                <Button
                  size="sm"
                  tone="gold"
                  busy={busy === s.SkinID}
                  onClick={() => void act(s.SkinID, "buy")}
                >
                  <ResourceList
                    lines={costLines(price.Cost as never)}
                    size={16}
                  />
                </Button>
              ) : (
                <span style={{ ...outlined, fontSize: 11, color: v.textDim }}>
                  {t("notForSale")}
                </span>
              )}
            </Card>
          );
        })}
      </div>
    </Popup>
  );
}
