// The fighting hero's numbers, from the title's Character config and the player's server state.
//
// ⚠ A MIRROR of the server's `PvPBattleEngine.CalculateStats` (iDos_Games_Engine, Match/Services) —
// the same three layers in the same order: (1) the stat's ValueCurve from level 0 and its RankCurve
// from rank 1, (2) gear flat bonuses scaled by the instance level, (3) percent bonuses. Health and
// damage also take the hero's RankStatCurve and "AllMight"; attack speed and chances do not. The
// Heroes screen (`modules/character/src/model.ts`) shows the same numbers — modules never import each
// other, so this is a copy kept to the server, not to that file.
//
// The server never sees this fight: stages are the game's own. What it does see is the hero's Power,
// which is what the gold income is paid on — so a stronger hero here is a richer one there.

import {
  curveMultiplier,
  evaluateCurve,
  roundAmount,
  type ScalarCurveSpec,
} from "@idosgames/core";

// ── Config / state views (only the fields read here) ─────────────────────────────────────────

interface Binding {
  PresetID?: string | null;
  Remove?: string[] | null;
}

type PriceOptions =
  | Record<
      string,
      {
        Cost?: {
          Standard?: {
            Entries?: Array<{
              Type?: string | null;
              CurrencyID?: string | null;
              Amount?: number | null;
            } | null> | null;
          } | null;
        } | null;
      } | null
    >
  | null
  | undefined;

export interface StatDefView {
  StatID?: string;
  DisplayName?: string | null;
  MaxLevel?: number | null;
  BaseStatValue?: number | null;
  ValueCurve?: ScalarCurveSpec | null;
  RankCurve?: ScalarCurveSpec | null;
  CostCurve?: ScalarCurveSpec | null;
  PriceOptions?: PriceOptions;
  Requirements?: Array<{
    RequiredStatID?: string;
    RequiredLevel?: number;
  } | null> | null;
}

export interface CharacterDefView {
  CharacterID?: string;
  Identity?: {
    DisplayName?: string | null;
    SortOrder?: number | null;
  } | null;
  Classification?: { ClassID?: string | null; RarityID?: string | null } | null;
  Unlock?: { UnlockedByDefault?: boolean | null } | null;
  Equipment?: { Slots?: Record<string, { SlotID?: string } | null> | null } | null;
  Stats?: Record<string, StatDefView | null> | null;
  RankStatCurve?: ScalarCurveSpec | null;
  StatMaxLevelCurve?: ScalarCurveSpec | null;
  Presets?: { Stats?: Binding | null } | null;
}

export interface CharacterSection {
  Definitions?: Record<string, CharacterDefView | null> | null;
  Presets?: {
    Stats?: Record<
      string,
      { Stats?: Record<string, StatDefView | null> | null } | null
    > | null;
  } | null;
}

export interface HeroModelView {
  CharacterID?: string;
  Level?: number | null;
  Power?: number | null;
  StatLevels?: Record<string, number> | null;
  Equipment?: Record<
    string,
    {
      ItemID?: string | null;
      CatalogID?: string | null;
      ItemInstanceID?: string | null;
      Level?: number | null;
    } | null
  > | null;
}

export interface GearDefView {
  Stats?: {
    FlatBonuses?: Record<string, number> | null;
    PercentBonuses?: Record<string, number> | null;
  } | null;
  Upgrade?: {
    FlatBonusCurve?: ScalarCurveSpec | null;
    PercentBonusCurve?: ScalarCurveSpec | null;
  } | null;
}

// ── Combat roles ─────────────────────────────────────────────────────────────────────────────

/**
 * Which stat plays which part in the fight. The first ids are the engine's own (DefaultData — the
 * only ones the server's Power counts); the rest let a title with its own names still fight.
 */
export const ROLE_STATS = {
  health: ["Health", "HP", "MaxHp"],
  damage: ["Damage", "Attack", "ATK", "Magic"],
  armor: ["Armor", "Defense", "DEF"],
  attackSpeed: ["AttackSpeed"],
  critChance: ["CritChance", "Crit"],
  critDamage: ["CritDamage"],
  dodge: ["Speed", "Dodge"],
  regen: ["HpRegen", "HealthRegen", "Regen"],
  multiShot: ["MultiShot", "TripleShot"],
  allMight: ["AllMight"],
} as const;

export type Role = keyof typeof ROLE_STATS;

/** Chances and the crit multiplier are shown in percent. */
export const PERCENT_ROLES: ReadonlySet<Role> = new Set([
  "critChance",
  "critDamage",
  "dodge",
  "multiShot",
]);

/** The server's clamps (MatchCombatSettings defaults). */
export const MAX_CRIT_CHANCE = 0.6;
export const MAX_DODGE_CHANCE = 0.4;
export const DEFAULT_CRIT_MULTIPLIER = 1.5;
export const MAX_MULTI_SHOT = 1;

export interface FighterStats {
  maxHp: number;
  damage: number;
  armor: number;
  /** Attacks per second. */
  attackSpeed: number;
  critChance: number;
  critMultiplier: number;
  dodge: number;
  /** HP restored per second. */
  regen: number;
  /** Chance of one extra shot at the next enemy. */
  multiShot: number;
}

// ── Stats of a hero ──────────────────────────────────────────────────────────────────────────

export interface StatInfo {
  id: string;
  name: string;
  role: Role | null;
  base: number;
  maxLevel: number;
  valueCurve?: ScalarCurveSpec | null;
  rankCurve?: ScalarCurveSpec | null;
  costCurve?: ScalarCurveSpec | null;
  /** First way to pay ("default cost"), per level 1. */
  price: { currencyID: string; amount: number } | null;
  requirements: Array<{ statID: string; level: number }>;
}

export function roleOf(statID: string): Role | null {
  for (const [role, ids] of Object.entries(ROLE_STATS))
    if ((ids as readonly string[]).includes(statID)) return role as Role;
  return null;
}

/** Preset stats (Presets.Stats) under the inline ones; Remove drops keys — the server's merge. */
export function resolveStats(
  section: CharacterSection | undefined,
  def: CharacterDefView | undefined,
): StatInfo[] {
  if (!def) return [];
  const binding = def.Presets?.Stats;
  const preset = binding?.PresetID
    ? section?.Presets?.Stats?.[binding.PresetID]?.Stats
    : undefined;
  const merged: Record<string, StatDefView> = {};
  for (const [k, s] of Object.entries(preset ?? {})) if (s) merged[k] = s;
  for (const [k, s] of Object.entries(def.Stats ?? {})) if (s) merged[k] = s;
  for (const k of binding?.Remove ?? []) delete merged[k];
  return Object.entries(merged).map(([key, s]) => {
    const id = s.StatID ?? key;
    const first = Object.values(s.PriceOptions ?? {}).find((o) => o);
    const entry = first?.Cost?.Standard?.Entries?.find(
      (e) => e?.CurrencyID && Number(e.Amount ?? 0) > 0,
    );
    return {
      id,
      name: s.DisplayName || id,
      role: roleOf(id),
      base: Number(s.BaseStatValue ?? 0),
      maxLevel: Number(s.MaxLevel ?? 0),
      valueCurve: s.ValueCurve,
      rankCurve: s.RankCurve,
      costCurve: s.CostCurve,
      price: entry
        ? { currencyID: entry.CurrencyID!, amount: Number(entry.Amount) }
        : null,
      requirements: (s.Requirements ?? [])
        .filter((r) => r?.RequiredStatID)
        .map((r) => ({
          statID: r!.RequiredStatID!,
          level: Number(r!.RequiredLevel ?? 0),
        })),
    };
  });
}

/** Layer 1 of one stat: ValueCurve from level 0, then the stat's own RankCurve from rank 1. */
export function levelValue(
  stat: StatInfo,
  level: number,
  rank: number,
): number {
  const own = evaluateCurve(stat.valueCurve, stat.base, Math.max(0, level), 0);
  return evaluateCurve(stat.rankCurve, own, Math.max(1, rank), 1);
}

/** The stat's cap at this rank: MaxLevel through the hero's StatMaxLevelCurve (0 = no cap). */
export function statCap(
  stat: StatInfo,
  rank: number,
  def: CharacterDefView | undefined,
): number {
  if (stat.maxLevel <= 0) return 0;
  return Math.ceil(
    evaluateCurve(def?.StatMaxLevelCurve, stat.maxLevel, Math.max(1, rank), 1),
  );
}

/** What raising a stat TO `nextLevel` costs — price × CostCurve(target level), rounded up once. */
export function statCost(stat: StatInfo, nextLevel: number): number {
  if (!stat.price) return 0;
  return roundAmount(
    stat.price.amount *
      curveMultiplier(stat.costCurve, Math.max(1, nextLevel), 1),
  );
}

/**
 * How many levels from `level` the balance buys (at most `limit`, never past the cap), and what they
 * cost together — what "×10" and "MAX" send in one call.
 */
export function affordableLevels(
  stat: StatInfo,
  level: number,
  cap: number,
  balance: number,
  limit: number,
): { levels: number; cost: number } {
  let levels = 0;
  let cost = 0;
  while (levels < limit && (cap <= 0 || level + levels < cap)) {
    const next = statCost(stat, level + levels + 1);
    if (next <= 0 || cost + next > balance) break;
    cost += next;
    levels++;
  }
  return { levels, cost };
}

// ── The fighter ──────────────────────────────────────────────────────────────────────────────

export interface HeroInput {
  section: CharacterSection | undefined;
  def: CharacterDefView | undefined;
  model: HeroModelView | undefined;
  /** Item definitions by item id. */
  items: Map<string, GearDefView>;
  /** Levels of item instances by instance id (the worn copy's own Level wins when present). */
  instanceLevels?: Record<string, number>;
}

/**
 * The rank the fight uses: the server's level, but a hero playable by default fights at rank 1 before
 * the server has materialized it (its first action does).
 */
export function heroRank(input: HeroInput): number {
  const level = Number(input.model?.Level ?? 0);
  if (level > 0) return level;
  return input.def?.Unlock?.UnlockedByDefault ? 1 : 0;
}

export function fighterStats(input: HeroInput): FighterStats {
  const rank = Math.max(1, heroRank(input));
  const stats = resolveStats(input.section, input.def);
  const levels = input.model?.StatLevels ?? {};
  const rankMult = curveMultiplier(input.def?.RankStatCurve, rank, 1);

  const byRole = (role: Role): number => {
    for (const id of ROLE_STATS[role]) {
      const stat = stats.find((s) => s.id === id);
      if (stat) return levelValue(stat, Number(levels[stat.id] ?? 0), rank);
    }
    return 0;
  };

  const flat: Record<string, number> = {};
  const pct: Record<string, number> = {};
  for (const worn of Object.values(input.model?.Equipment ?? {})) {
    if (!worn?.ItemID) continue;
    const def = input.items.get(worn.ItemID);
    if (!def?.Stats) continue;
    const instLevel =
      worn.Level ??
      (worn.ItemInstanceID
        ? input.instanceLevels?.[worn.ItemInstanceID]
        : undefined);
    const level = Math.max(1, Number(instLevel ?? 1));
    const flatScale = curveMultiplier(def.Upgrade?.FlatBonusCurve, level, 1);
    const pctScale = curveMultiplier(def.Upgrade?.PercentBonusCurve, level, 1);
    for (const [k, n] of Object.entries(def.Stats.FlatBonuses ?? {}))
      flat[k] = (flat[k] ?? 0) + Number(n || 0) * flatScale;
    for (const [k, n] of Object.entries(def.Stats.PercentBonuses ?? {}))
      pct[k] = (pct[k] ?? 0) + Number(n || 0) * pctScale;
  }
  const gear = (table: Record<string, number>, role: Role): number =>
    ROLE_STATS[role].reduce((s, id) => s + (table[id] ?? 0), 0);

  const allMight = byRole("allMight") + gear(pct, "allMight");
  const global = 1 + allMight;

  const critMultiplier =
    byRole("critDamage") + gear(flat, "critDamage") + gear(pct, "critDamage");
  return {
    maxHp: Math.max(
      1,
      (byRole("health") * rankMult + gear(flat, "health")) * global,
    ),
    damage: (byRole("damage") * rankMult + gear(flat, "damage")) * global,
    armor: byRole("armor") * rankMult + gear(flat, "armor"),
    attackSpeed: Math.max(
      0.1,
      (byRole("attackSpeed") + gear(flat, "attackSpeed")) *
        (1 + gear(pct, "attackSpeed")),
    ),
    critChance: clamp(
      byRole("critChance") + gear(flat, "critChance") + gear(pct, "critChance"),
      0,
      MAX_CRIT_CHANCE,
    ),
    critMultiplier:
      critMultiplier > 0 ? critMultiplier : DEFAULT_CRIT_MULTIPLIER,
    dodge: clamp(
      byRole("dodge") + gear(flat, "dodge") + gear(pct, "dodge"),
      0,
      MAX_DODGE_CHANCE,
    ),
    regen: Math.max(0, byRole("regen") * rankMult + gear(flat, "regen")),
    multiShot: clamp(
      byRole("multiShot") + gear(flat, "multiShot") + gear(pct, "multiShot"),
      0,
      MAX_MULTI_SHOT,
    ),
  };
}

/** The value a stat shows in the Enhance list at a given level (its role's final number). */
export function enhanceValue(
  input: HeroInput,
  statID: string,
  level: number,
): number {
  const role = roleOf(statID);
  const model: HeroModelView = {
    ...input.model,
    StatLevels: { ...(input.model?.StatLevels ?? {}), [statID]: level },
  };
  const field = role ? ROLE_FIELD[role] : null;
  if (!field) {
    const stat = resolveStats(input.section, input.def).find(
      (s) => s.id === statID,
    );
    return stat ? levelValue(stat, level, Math.max(1, heroRank(input))) : 0;
  }
  return fighterStats({ ...input, model })[field];
}

/** Where a role ends up among the fighter's numbers (AllMight multiplies others — shown as its own value). */
const ROLE_FIELD: Record<Role, keyof FighterStats | null> = {
  health: "maxHp",
  damage: "damage",
  armor: "armor",
  attackSpeed: "attackSpeed",
  critChance: "critChance",
  critDamage: "critMultiplier",
  dodge: "dodge",
  regen: "regen",
  multiShot: "multiShot",
  allMight: null,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
