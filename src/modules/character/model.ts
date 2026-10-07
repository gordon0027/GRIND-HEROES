// Pure helpers of the heroes screen (Unity IdleRPG/Runtime/Character + Equipment): the roster,
// merged stats/ladder/slots (preset base + inline override, Remove drops keys — the server's rule),
// prices of ranks, stats and item levels, which gear fits a slot, the best loadout, and where a
// stat's number comes from. No React, no client calls — covered by model.test.ts.
//
// The server is the authority on every number: these only drive what the screen shows before the
// player taps, and a rejected action is surfaced as the server's error.

import {
  curveMultiplier,
  evaluateCurve,
  roundAmount,
  type ScalarCurveSpec,
} from "@idosgames/core";
import {
  costLines,
  formatAmount,
  rarityRank,
  type ItemDefinitionView,
  type ResourceLine,
} from "@idosgames/react/ui";

// ── Config views ─────────────────────────────────────────────────────────────────────────────

type PriceOptionsView =
  | Record<string, { OptionID?: string | null; Cost?: unknown } | null>
  | null
  | undefined;

export interface StatDefView {
  StatID?: string;
  DisplayName?: string | null;
  Description?: string | null;
  MaxLevel?: number | null;
  BaseStatValue?: number | null;
  ValueCurve?: ScalarCurveSpec | null;
  RankCurve?: ScalarCurveSpec | null;
  CostCurve?: ScalarCurveSpec | null;
  PriceOptions?: PriceOptionsView;
  Requirements?: Array<{
    RequiredStatID?: string;
    RequiredLevel?: number;
  } | null> | null;
}

export interface SlotRuleView {
  SlotID?: string;
  MinCharacterLevel?: number | null;
  AllowedItemTags?: string[] | null;
  AllowedRarityIDs?: string[] | null;
  MinItemLevel?: number | null;
  MaxItemLevel?: number | null;
}

export interface RankLadderView {
  MaxRank?: number | null;
  FirstPaidRank?: number | null;
  PriceOptions?: PriceOptionsView;
  CostCurve?: ScalarCurveSpec | null;
}

interface Binding {
  PresetID?: string | null;
  Remove?: string[] | null;
}

export interface SkinDefView {
  SkinID?: string;
  Identity?: {
    DisplayName?: string | null;
    SortOrder?: number | null;
    AssetPaths?: Record<string, string> | null;
  } | null;
  Item?: { CatalogID?: string | null; ItemID?: string | null } | null;
}

export interface CharacterDefView {
  CharacterID?: string;
  Identity?: {
    DisplayName?: string | null;
    Description?: string | null;
    SortOrder?: number | null;
    AssetPaths?: Record<string, string> | null;
  } | null;
  Classification?: { ClassID?: string | null; RarityID?: string | null } | null;
  Unlock?: {
    UnlockedByDefault?: boolean | null;
    PriceOptions?: PriceOptionsView;
  } | null;
  Stats?: Record<string, StatDefView | null> | null;
  RankLadder?: RankLadderView | null;
  RankStatCurve?: ScalarCurveSpec | null;
  StatMaxLevelCurve?: ScalarCurveSpec | null;
  Equipment?: { Slots?: Record<string, SlotRuleView | null> | null } | null;
  Skins?: {
    DefaultSkinID?: string | null;
    Definitions?: Record<string, SkinDefView | null> | null;
  } | null;
  Presets?: {
    Stats?: Binding | null;
    Levels?: Binding | null;
    Equipment?: Binding | null;
  } | null;
}

export interface CharacterSection {
  Definitions?: Record<string, CharacterDefView | null> | null;
  Presets?: {
    Stats?: Record<
      string,
      { Stats?: Record<string, StatDefView | null> | null } | null
    > | null;
    Levels?: Record<
      string,
      { RankLadder?: RankLadderView | null } | null
    > | null;
    Equipment?: Record<
      string,
      {
        Equipment?: {
          Slots?: Record<string, SlotRuleView | null> | null;
        } | null;
      } | null
    > | null;
  } | null;
}

// ── State views ──────────────────────────────────────────────────────────────────────────────

export interface CharacterModelView {
  CharacterID?: string;
  Level?: number | null;
  Power?: number | null;
  StatLevels?: Record<string, number> | null;
  Equipment?: Record<
    string,
    { ItemID?: string | null; ItemInstanceID?: string | null } | null
  > | null;
}

export interface InstanceView {
  ItemID?: string;
  Level?: number | null;
  EquippedSlot?: { CharacterID?: string | null; SlotID?: string | null } | null;
}

export interface ItemDefWithGear extends ItemDefinitionView {
  Stats?: {
    FlatBonuses?: Record<string, number> | null;
    PercentBonuses?: Record<string, number> | null;
    Power?: number | null;
  } | null;
  Equipment?: {
    MinCharacterLevel?: number | null;
    AllowedSlotIDs?: string[] | null;
    AllowedCharacterIDs?: string[] | null;
  } | null;
  Upgrade?: {
    MaxLevel?: number | null;
    PriceOptions?: PriceOptionsView;
    CostCurve?: ScalarCurveSpec | null;
    FlatBonusCurve?: ScalarCurveSpec | null;
    PowerCurve?: ScalarCurveSpec | null;
  } | null;
}

/** The reserved equipment key of the worn skin (SKIN_SLOT in @idosgames/core). */
export const SKIN_KEY = "@skin";

// ── Presets ──────────────────────────────────────────────────────────────────────────────────

/** Preset base + inline override/add by key, Remove drops keys. No preset → inline as-is. */
export function mergeByKey<T>(
  preset: Record<string, T | null> | null | undefined,
  inline: Record<string, T | null> | null | undefined,
  remove: readonly string[] | null | undefined,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(preset ?? {})) if (v) out[k] = v;
  for (const [k, v] of Object.entries(inline ?? {})) if (v) out[k] = v;
  for (const k of remove ?? []) delete out[k];
  return out;
}

/** First way to pay → lines ("default cost", like the server's PriceOptionSelector.DefaultCost). */
export function firstPrice(options: PriceOptionsView): ResourceLine[] {
  const first = Object.values(options ?? {}).find((o) => o);
  return first ? costLines(first.Cost as never) : [];
}

function scale(lines: ResourceLine[], multiplier: number): ResourceLine[] {
  return lines.map((l) => ({
    ...l,
    amount: roundAmount(l.amount * multiplier),
  }));
}

// ── Roster ───────────────────────────────────────────────────────────────────────────────────

export type HeroState = "owned" | "available" | "locked";

export interface RosterEntry {
  id: string;
  def: CharacterDefView;
  model: CharacterModelView | undefined;
  state: HeroState;
  rank: number;
  power: number;
  unlockPrice: ResourceLine[];
}

/** Heroes in roster order (SortOrder, then id), each with its state for this player. */
export function roster(
  section: CharacterSection | undefined,
  owned:
    Record<string, CharacterModelView | null | undefined> | null | undefined,
): RosterEntry[] {
  return Object.entries(section?.Definitions ?? {})
    .map(([id, def]) => ({ id: def?.CharacterID ?? id, def }))
    .filter((x): x is { id: string; def: CharacterDefView } => !!x.def)
    .sort(
      (a, b) =>
        Number(a.def.Identity?.SortOrder ?? 0) -
          Number(b.def.Identity?.SortOrder ?? 0) || a.id.localeCompare(b.id),
    )
    .map(({ id, def }) => {
      const model = owned?.[id] ?? undefined;
      const rank = Number(model?.Level ?? 0);
      const state: HeroState =
        rank >= 1
          ? "owned"
          : def.Unlock?.UnlockedByDefault
            ? "available"
            : "locked";
      return {
        id,
        def,
        model,
        state,
        rank: Math.max(rank, state === "available" ? 1 : 0),
        power: Number(model?.Power ?? 0),
        unlockPrice: firstPrice(def.Unlock?.PriceOptions),
      };
    });
}

// ── Stats ────────────────────────────────────────────────────────────────────────────────────

export interface StatView {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  base: number;
  valueCurve?: ScalarCurveSpec | null;
  rankCurve?: ScalarCurveSpec | null;
  costCurve?: ScalarCurveSpec | null;
  price: ResourceLine[];
  requirements: Array<{ statID: string; level: number }>;
}

export function resolveStats(
  section: CharacterSection | undefined,
  def: CharacterDefView | undefined,
): StatView[] {
  if (!def) return [];
  const binding = def.Presets?.Stats;
  const preset = binding?.PresetID
    ? section?.Presets?.Stats?.[binding.PresetID]?.Stats
    : undefined;
  return Object.entries(mergeByKey(preset, def.Stats, binding?.Remove)).map(
    ([id, s]) => ({
      id: s.StatID ?? id,
      name: s.DisplayName || id,
      description: s.Description || "",
      maxLevel: Number(s.MaxLevel ?? 0),
      base: Number(s.BaseStatValue ?? 0),
      valueCurve: s.ValueCurve,
      rankCurve: s.RankCurve,
      costCurve: s.CostCurve,
      price: firstPrice(s.PriceOptions),
      requirements: (s.Requirements ?? [])
        .filter((r) => r?.RequiredStatID)
        .map((r) => ({
          statID: r!.RequiredStatID!,
          level: Number(r!.RequiredLevel ?? 0),
        })),
    }),
  );
}

/**
 * Stat value at stat-level `level` for a hero of rank `rank`: the stat's ValueCurve from 0, its
 * RankCurve and the hero's RankStatCurve from 1 — the order the server composes them in.
 */
export function statValue(
  stat: StatView,
  level: number,
  rank: number,
  def?: CharacterDefView,
): number {
  const own = evaluateCurve(
    stat.valueCurve ?? undefined,
    stat.base,
    Math.max(0, level),
    0,
  );
  const byRank = evaluateCurve(
    stat.rankCurve ?? undefined,
    own,
    Math.max(1, rank),
    1,
  );
  return evaluateCurve(
    def?.RankStatCurve ?? undefined,
    byRank,
    Math.max(1, rank),
    1,
  );
}

/**
 * A stat's number on screen: small ones keep their fraction (a 0.12 crit chance, 1.05 attacks per
 * second — rounding them to a tenth showed "0" and "1"), big ones go through the kit's formatter.
 */
export function statNumber(value: number): string {
  if (Math.abs(value) < 10 && !Number.isInteger(value))
    return value.toFixed(2).replace(/\.?0+$/, "");
  return formatAmount(Math.round(value * 10) / 10);
}

/** The effective cap of a stat at a rank: MaxLevel through the hero's StatMaxLevelCurve. */
export function statMaxLevel(
  stat: StatView,
  rank: number,
  def?: CharacterDefView,
): number {
  if (stat.maxLevel <= 0) return 0;
  return Math.ceil(
    evaluateCurve(
      def?.StatMaxLevelCurve ?? undefined,
      stat.maxLevel,
      Math.max(1, rank),
      1,
    ),
  );
}

/** What raising a stat TO `nextLevel` costs (base price through CostCurve, rounded up once). */
export function statCost(stat: StatView, nextLevel: number): ResourceLine[] {
  return scale(
    stat.price,
    curveMultiplier(stat.costCurve ?? undefined, Math.max(1, nextLevel), 1),
  );
}

/** Requirements of a stat the hero has not met yet. */
export function unmetRequirements(
  stat: StatView,
  levels: Record<string, number> | null | undefined,
): Array<{ statID: string; level: number }> {
  return stat.requirements.filter(
    (r) => Number(levels?.[r.statID] ?? 0) < r.level,
  );
}

/** Most levels one "Upgrade all" buys (Unity CharacterStatPopup.MaxBatchTotalLevels). */
export const UPGRADE_ALL_MAX_LEVELS = 1000;

/**
 * "Upgrade all" (Unity CharacterStatPopup.CollectUpgradePlan): spend the balances on as many stat
 * levels as they cover, always buying the globally CHEAPEST next level — so a shared currency spreads
 * across the stats instead of pouring into the first one. Skips stats at their cap, without a price,
 * or with an unmet requirement (the batch is all-or-nothing on the server: one refused stat would
 * void the whole purchase). Returns one entry per stat that gains a level.
 */
export function upgradeAllPlan(
  stats: StatView[],
  levels: Record<string, number> | null | undefined,
  rank: number,
  def: CharacterDefView | undefined,
  balances:
    Record<string, { Amount?: number } | null | undefined> | null | undefined,
): Array<{ StatID: string; Levels: number }> {
  const left = new Map<string, number>();
  const plans = stats
    .filter(
      (s) => s.price.length > 0 && unmetRequirements(s, levels).length === 0,
    )
    .map((s) => {
      const from = Number(levels?.[s.id] ?? 0);
      return { stat: s, from, to: from, cap: statMaxLevel(s, rank, def) };
    });
  for (const p of plans)
    for (const line of p.stat.price)
      if (line.kind === "currency" && !left.has(line.id))
        left.set(line.id, Number(balances?.[line.id]?.Amount ?? 0));

  const affordable = (cost: ResourceLine[]) =>
    cost.length > 0 &&
    cost.every(
      (l) => l.kind === "currency" && (left.get(l.id) ?? 0) >= l.amount,
    );

  type Pick = { plan: (typeof plans)[number]; cost: ResourceLine[] };
  for (let n = 0; n < UPGRADE_ALL_MAX_LEVELS; n++) {
    let best: (Pick & { total: number }) | null = null;
    for (const p of plans) {
      if (p.cap > 0 && p.to >= p.cap) continue;
      const cost = statCost(p.stat, p.to + 1);
      if (!affordable(cost)) continue;
      const total = cost.reduce((s, l) => s + l.amount, 0);
      if (!best || total < best.total) best = { plan: p, cost, total };
    }
    if (!best) break;
    best.plan.to += 1;
    for (const l of best.cost) left.set(l.id, (left.get(l.id) ?? 0) - l.amount);
  }
  return plans
    .filter((p) => p.to > p.from)
    .map((p) => ({ StatID: p.stat.id, Levels: p.to - p.from }));
}

// ── Ranks ────────────────────────────────────────────────────────────────────────────────────

export function resolveLadder(
  section: CharacterSection | undefined,
  def: CharacterDefView | undefined,
): RankLadderView | null {
  if (!def) return null;
  if (def.RankLadder) return def.RankLadder;
  const id = def.Presets?.Levels?.PresetID;
  return id ? (section?.Presets?.Levels?.[id]?.RankLadder ?? null) : null;
}

/** What the next rank costs; `null` — the hero cannot rank up (no ladder, or at the ceiling). */
export function rankCost(
  ladder: RankLadderView | null,
  currentRank: number,
): ResourceLine[] | null {
  if (!ladder) return null;
  const next = currentRank + 1;
  if (ladder.MaxRank && next > ladder.MaxRank) return null;
  const firstPaid = Math.max(1, Number(ladder.FirstPaidRank ?? 1));
  if (next < firstPaid) return [];
  return scale(
    firstPrice(ladder.PriceOptions),
    curveMultiplier(ladder.CostCurve ?? undefined, next, firstPaid),
  );
}

// ── Equipment ────────────────────────────────────────────────────────────────────────────────

export interface SlotView {
  id: string;
  minRank: number;
  rule: SlotRuleView;
}

/** Gear slots of a hero (the reserved "@…" keys — the worn skin — are not slots). */
export function resolveSlots(
  section: CharacterSection | undefined,
  def: CharacterDefView | undefined,
): SlotView[] {
  if (!def) return [];
  const binding = def.Presets?.Equipment;
  const preset = binding?.PresetID
    ? section?.Presets?.Equipment?.[binding.PresetID]?.Equipment?.Slots
    : undefined;
  return Object.entries(
    mergeByKey(preset, def.Equipment?.Slots, binding?.Remove),
  )
    .filter(([id]) => !id.startsWith("@"))
    .map(([id, rule]) => ({
      id: rule.SlotID ?? id,
      minRank: Number(rule.MinCharacterLevel ?? 0),
      rule,
    }));
}

export interface GearPiece {
  instanceID: string;
  itemID: string;
  level: number;
  equippedBy: { characterID: string; slotID: string } | null;
}

/** Every gear instance the player owns (unstackable items that declare equip rules). */
export function gearPieces(
  instances: Record<string, InstanceView | null> | null | undefined,
  items: Map<string, ItemDefWithGear>,
): GearPiece[] {
  return Object.entries(instances ?? {})
    .filter(([, i]) => i?.ItemID && items.get(i.ItemID)?.Equipment)
    .map(([id, i]) => ({
      instanceID: id,
      itemID: i!.ItemID!,
      level: Number(i!.Level ?? 1) || 1,
      equippedBy:
        i!.EquippedSlot?.CharacterID && i!.EquippedSlot.SlotID
          ? {
              characterID: i!.EquippedSlot.CharacterID,
              slotID: i!.EquippedSlot.SlotID,
            }
          : null,
    }));
}

/** Why a piece cannot go into a slot of this hero, or null when it fits (both sides of the matrix). */
export function fitProblem(
  piece: GearPiece,
  slot: SlotView,
  heroID: string,
  rank: number,
  items: Map<string, ItemDefWithGear>,
): "slot" | "rank" | "rarity" | "tags" | "level" | "hero" | null {
  const def = items.get(piece.itemID);
  const allowed = def?.Equipment?.AllowedSlotIDs ?? [];
  if (allowed.length > 0 && !allowed.includes(slot.id)) return "slot";
  if (
    def?.Equipment?.AllowedCharacterIDs?.length &&
    !def.Equipment.AllowedCharacterIDs.includes(heroID)
  )
    return "hero";
  if (
    rank < slot.minRank ||
    rank < Number(def?.Equipment?.MinCharacterLevel ?? 0)
  )
    return "rank";
  const r = slot.rule;
  if (
    r.AllowedRarityIDs?.length &&
    !r.AllowedRarityIDs.includes(def?.Metadata?.RarityID ?? "")
  )
    return "rarity";
  if (
    r.AllowedItemTags?.length &&
    !(def?.Tags ?? []).some((t) => r.AllowedItemTags!.includes(t))
  )
    return "tags";
  if ((r.MinItemLevel ?? 0) > 0 && piece.level < (r.MinItemLevel ?? 0))
    return "level";
  if ((r.MaxItemLevel ?? 0) > 0 && piece.level > (r.MaxItemLevel ?? 0))
    return "level";
  return null;
}

/** A comparable strength of a piece: its Power by level, else the sum of its flat bonuses. */
export function gearScore(
  piece: GearPiece,
  items: Map<string, ItemDefWithGear>,
): number {
  const def = items.get(piece.itemID);
  const power = Number(def?.Stats?.Power ?? 0);
  if (power > 0)
    return (
      power *
      curveMultiplier(def?.Upgrade?.PowerCurve ?? undefined, piece.level, 1)
    );
  const flat = Object.values(def?.Stats?.FlatBonuses ?? {}).reduce(
    (s, n) => s + Number(n || 0),
    0,
  );
  return (
    flat *
      curveMultiplier(
        def?.Upgrade?.FlatBonusCurve ?? undefined,
        piece.level,
        1,
      ) +
    (4 - Math.min(4, rarityRank(def?.Metadata?.RarityID))) * 0.01
  );
}

/**
 * "Equip best" (Unity EquipmentAutoAssign): per unlocked slot, the strongest fitting piece not worn
 * by another hero and not taken by an earlier slot. Returns only the slots that would CHANGE.
 */
export function bestLoadout(
  heroID: string,
  rank: number,
  slots: SlotView[],
  pieces: GearPiece[],
  current: CharacterModelView["Equipment"],
  items: Map<string, ItemDefWithGear>,
): Array<{ SlotID: string; ItemInstanceID: string }> {
  const taken = new Set<string>();
  const changes: Array<{ SlotID: string; ItemInstanceID: string }> = [];
  for (const slot of slots) {
    const candidates = pieces
      .filter((p) => !taken.has(p.instanceID))
      .filter((p) => !p.equippedBy || p.equippedBy.characterID === heroID)
      .filter((p) => fitProblem(p, slot, heroID, rank, items) === null)
      .sort(
        (a, b) =>
          gearScore(b, items) - gearScore(a, items) ||
          a.instanceID.localeCompare(b.instanceID),
      );
    const best = candidates[0];
    if (!best) continue;
    taken.add(best.instanceID);
    const worn = current?.[slot.id]?.ItemInstanceID ?? null;
    const wornPiece = worn
      ? pieces.find((p) => p.instanceID === worn)
      : undefined;
    if (worn === best.instanceID) continue;
    if (wornPiece && gearScore(wornPiece, items) >= gearScore(best, items)) {
      taken.add(worn!);
      continue;
    }
    changes.push({ SlotID: slot.id, ItemInstanceID: best.instanceID });
  }
  return changes;
}

/** What raising an item instance TO `nextLevel` costs; null — at its cap or not upgradable. */
export function itemLevelCost(
  def: ItemDefWithGear | undefined,
  currentLevel: number,
): ResourceLine[] | null {
  const up = def?.Upgrade;
  if (!up) return null;
  const next = currentLevel + 1;
  if ((up.MaxLevel ?? 0) > 0 && next > (up.MaxLevel ?? 0)) return null;
  return scale(
    firstPrice(up.PriceOptions),
    curveMultiplier(up.CostCurve ?? undefined, next, 1),
  );
}

/** Flat bonuses of a piece at its level (the item's FlatBonusCurve), by stat id. */
export function pieceBonuses(
  def: ItemDefWithGear | undefined,
  level: number,
): Record<string, number> {
  const k = curveMultiplier(
    def?.Upgrade?.FlatBonusCurve ?? undefined,
    Math.max(1, level),
    1,
  );
  return Object.fromEntries(
    Object.entries(def?.Stats?.FlatBonuses ?? {}).map(([id, n]) => [
      id,
      Number(n || 0) * k,
    ]),
  );
}

// ── "Where does this number come from" (Unity StatBreakdownPopup) ────────────────────────────

export interface Breakdown {
  base: number;
  fromLevel: number;
  fromRank: number;
  fromGear: number;
  percent: number;
  total: number;
}

/**
 * The parts of a stat: the base, what its own levels add, what the rank adds, flat bonuses of the
 * worn gear, then their percent bonuses — added in that order, so the parts sum to the total.
 */
export function breakdown(
  stat: StatView,
  level: number,
  rank: number,
  def: CharacterDefView | undefined,
  worn: Array<{ def: ItemDefWithGear | undefined; level: number }>,
): Breakdown {
  const base = stat.base;
  const withLevel = evaluateCurve(
    stat.valueCurve ?? undefined,
    base,
    Math.max(0, level),
    0,
  );
  const withRank = statValue(stat, level, rank, def);
  const fromGear = worn.reduce(
    (s, w) => s + (pieceBonuses(w.def, w.level)[stat.id] ?? 0),
    0,
  );
  const percent = worn.reduce(
    (s, w) => s + Number(w.def?.Stats?.PercentBonuses?.[stat.id] ?? 0),
    0,
  );
  const subtotal = withRank + fromGear;
  const total = subtotal * (1 + percent / 100);
  return {
    base,
    fromLevel: withLevel - base,
    fromRank: withRank - withLevel,
    fromGear,
    percent,
    total,
  };
}

/**
 * Slots "Take off all" asks the server to empty (Unity EquipmentPanel.CollectUnequipSlotIDs): every
 * slot the hero's config declares, plus every slot the local data says is worn — by the hero's own
 * map AND by the instances that remember being worn by this hero. The server empties only what IS
 * worn on its side and skips the rest, so stale local data stops mattering. The worn skin ("@skin")
 * is not gear and stays on.
 */
export function unequipAllSlots(
  heroID: string,
  slots: SlotView[],
  current: CharacterModelView["Equipment"],
  pieces: GearPiece[],
): string[] {
  const out = new Set<string>();
  for (const s of slots) out.add(s.id);
  for (const id of Object.keys(current ?? {})) out.add(id);
  for (const p of pieces)
    if (p.equippedBy?.characterID === heroID) out.add(p.equippedBy.slotID);
  return [...out].filter((id) => id && !id.startsWith("@"));
}

// ── Badge ────────────────────────────────────────────────────────────────────────────────────

/** Badge of the heroes screen: heroes that can be unlocked or ranked up right now, plus better gear. */
export function heroesBadge(
  entries: RosterEntry[],
  canPay: (lines: ResourceLine[]) => boolean,
  ladderOf: (e: RosterEntry) => RankLadderView | null,
  betterGear: number,
): number {
  let n = 0;
  for (const e of entries) {
    if (
      e.state === "locked" &&
      e.unlockPrice.length > 0 &&
      canPay(e.unlockPrice)
    )
      n++;
    if (e.state !== "locked") {
      const cost = rankCost(ladderOf(e), e.rank);
      if (cost && cost.length > 0 && canPay(cost)) n++;
    }
  }
  return n + (betterGear > 0 ? 1 : 0);
}

/** Whether the title has heroes at all — until it does, the lobby hides the Heroes tab. */
export function hasTitleData(section: CharacterSection | undefined): boolean {
  return Object.keys(section?.Definitions ?? {}).length > 0;
}
