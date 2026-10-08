// The game's state for the whole session — created once in setup(), outliving the Phaser scene
// (the Mode Router destroys a hidden mode; the fight, the progress and the queues must not reset).
//
// It owns the server-backed formation, live character stats, transient StageRun, the template's
// dormant Battle/Enhance state and the existing iDos idle-GOLD collection.

import type { IDosGamesClient } from "@idosgames/core";
import {
  configSection,
  itemDefinitions,
  type ItemSection,
} from "@idosgames/react/ui";
import { Battle, type BattleEvent } from "./battle";
import {
  METRIC_STAGE_CLEARED,
  METRIC_STAT_ENHANCED,
  incomePerSecond,
  pickIncome,
  questMetric,
  type Income,
  type QuestSection,
  type RewardSection,
} from "./economy";
import {
  affordableLevels,
  fighterStats,
  heroRank,
  resolveStats,
  statCap,
  type CharacterDefView,
  type CharacterSection,
  type FighterStats,
  type GearDefView,
  type HeroInput,
  type HeroModelView,
  type StatInfo,
} from "./heroStats";
import { stageInfo } from "./stages";
import { FIRST_STAGE, StageRun, type PartySlot, type RunEvent } from "./stageRun";
import { STAGE_CATALOG, stageByID } from "./stageCatalog";
import { continuationStageID, farmingStageID } from "./stageFlow";
import { parseStageProgress, stageUnlocked, STAGE_PROGRESS_KEY, type StageProgress } from "./stageProgress";
import { StageService } from "./stageService";
import { HERO_XP_KEY, heroProgress, parseHeroProgress, type HeroProgressMap } from "./heroXP";
import { FORMATION_KEY, PARTY_CAPACITY_KEY, assignFormation, defaultFormation, partyCapacity,
  restoreFormation, validateFormation, type Formation } from "./formation";
import { heroArchetype } from "./heroArchetypes";
import { GOLD_CURRENCY_ID, RECRUITABLE_HERO_IDS, heroRecruitCost, isPlayableHeroID } from "./progression";
import type { SlotIndex } from "./stageRun";
import { combatPower, equipProblems, equippedIn, grindFighterStats, ownedGear, stageHeroStats, totalBonuses,
  type GearDefinition, type GearInstance, type GearItem, type GearSlot } from "./equipment";
import { GrindEquipmentService, attestedGrindAssignments, emptyGrindEquipment,
  type GrindEquipmentState } from "./grindEquipment";
import { chestRewardItemID, chestRewardPreview, newlyGrantedGear } from "./chestReward";
import { chestIDs, chestPool } from "./chestPools";
import { TeamPowerService, type TeamPowerLeaderboard } from "./teamPower";

/** The private custom-data key of the stage progress ("." and "$" are not allowed in keys). */
export const PROGRESS_KEY = "idle_rpg_progress";
const SAVE_DELAY_MS = 4000;
/** Below this, a collect on entry is just "the counter ticked", not "while you were away". */
const AWAY_MIN_SECONDS = 60;
const COLLECT_EVERY_MS = 15_000;
/** How often the HUD redraws while the fight runs. */
const HUD_HZ = 8;
const STAGE_PREFERENCES_KEY = "grind_stage_preferences_v1";
const TURN_EVENTS = new Set<BattleEvent["type"]>([
  "stageCleared",
  "bossStart",
  "bossFailed",
  "heroDown",
  "heroUp",
  "skill",
]);

export interface HeroView {
  id: string;
  name: string;
  classID: string;
  rarity: string;
  rank: number;
  level: number;
  xp: number;
  power: number;
  def: CharacterDefView;
  input: HeroInput;
  stats: StatInfo[];
  fighter: FighterStats;
  baseFighter: FighterStats;
}

export interface AwayReport {
  amount: number;
  seconds: number;
  currencyID: string;
}

export type Notice =
  { kind: "error"; text: string } | { kind: "notEnough"; currencyID: string };

export interface SessionCallbacks {
  /** A stage was cleared — the module turns it into its event for other modules. */
  onStageCleared?: (chapter: number, stage: number) => void;
  /** A hero's rank went up (anywhere — the Heroes screen too). */
  onRankUp?: (characterId: string, level: number) => void;
}

type Listener = () => void;

export class IdleSession {
  readonly battle = new Battle();
  run = new StageRun(FIRST_STAGE);
  stageProgress: StageProgress = parseStageProgress(null);
  stageError: string | null = null;
  runStartBusy = false;
  validatedClearSeconds: number | null = null;
  previousBestSeconds: number | null = null;
  lootGold = 0;
  private serverRunId: string | null = null;
  private readonly stageService: StageService;
  private readonly equipmentService: GrindEquipmentService;
  private readonly teamPowerService: TeamPowerService;
  /** The hero the Heroes screen selected, or null until it says (then the fallback fights). */
  selectedID: string | null = "Knight";
  hero: HeroView | null = null;
  roster: HeroView[] = [];
  gearItems: GearItem[] = [];
  grindEquipment: GrindEquipmentState = emptyGrindEquipment();
  equipmentReady = false;
  equipmentBusy = false;
  equipmentError: string | null = null;
  lootPending = false;
  lootBusy = false;
  lootError: string | null = null;
  lootItems: string[] = [];
  chestDrop: { item: GearItem; sequence: number } | null = null;
  private chestDropSequence = 0;
  private chestDropTimer: ReturnType<typeof setTimeout> | null = null;
  private managementWrites = new Set<Promise<unknown>>();
  private managementRevision = 0;
  private stagePartyDirty = false;
  private runGeneration = 0;
  private startRequest: Promise<boolean> | null = null;
  lastClearNotice: string | null = null;
  lastLevelNotice: string | null = null;
  heroProgressMap: HeroProgressMap = {};
  private autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private autoFlowEnabled = false;
  autoProgressEnabled = true;
  private pendingContinuationID: string | null = null;
  private terminalRun: StageRun | null = null;
  private failureClose: Promise<void> | null = null;
  private preferenceWrites: Promise<unknown> = Promise.resolve();
  formation: Formation = { version: 2, slots: [null, null, null] };
  capacity: 1 | 2 | 3 = 1;
  formationBusy = false;
  formationError: string | null = null;
  formationStored = false;
  recruitBusy = false;
  recruitError: string | null = null;
  slotPurchaseBusy = false;
  slotPurchaseError: string | null = null;
  slotCosts: { 2: number; 3: number } | null = null;
  private previewCapacity: 1 | 2 | 3 | null = null;
  private previewReturnStageID: string | null = null;
  private previewFormation: Formation | null = null;
  income: Income | null = null;
  away: AwayReport | null = null;
  /** Gold the last collect brought (for the "+X" float), and when. */
  lastCollect: { amount: number; at: number } | null = null;
  notice: (Notice & { at: number }) | null = null;
  loaded = false;
  teamPower: number | null = null;
  teamPowerError: string | null = null;
  teamLeaderboard: TeamPowerLeaderboard | null = null;
  teamLeaderboardBusy = false;
  private teamPowerSignature = "";
  private teamPowerRevision = 0;
  private teamPowerTimer: ReturnType<typeof setTimeout> | null = null;
  private teamPowerRefresh: Promise<void> | null = null;

  private version = 0;
  private listeners = new Set<Listener>();
  private hudClock = 0;
  private collectTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private collecting = false;
  private firstCollect = true;
  private enhanceQueue = new Map<string, { pending: number; busy: boolean }>();
  private metricQueue = new Map<string, { pending: number; busy: boolean }>();
  private offClient: Array<() => void> = [];
  private ownershipRefresh: Promise<void> | null = null;

  constructor(
    private readonly client: IDosGamesClient,
    private readonly callbacks: SessionCallbacks = {},
  ) {
    this.stageService = new StageService(client);
    this.equipmentService = new GrindEquipmentService(client);
    this.teamPowerService = new TeamPowerService(client);
    // Removed in destroy(): setup() runs again on every login, and a client subscription that
    // outlived its session would keep a dead game recomputing — and emitting twice.
    this.offClient.push(
      client.on("user:anyUpdated", () => this.refreshHero()),
      client.on("character:levelUpgraded", (data) =>
        callbacks.onRankUp?.(data.CharacterID, data.NewLevel),
      ),
    );
    this.refreshHero();
    void this.load();
  }

  // ── React bridge ───────────────────────────────────────────────────────────────────────────

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private changed(): void {
    this.version++;
    for (const l of [...this.listeners]) l();
  }

  // ── The hero ───────────────────────────────────────────────────────────────────────────────

  selectHero(id: string): void {
    if (id === this.selectedID) return;
    this.selectedID = id;
    this.refreshHero();
  }

  /** Re-reads the hero from the cache: an upgrade, new gear or another hero changes the fighter. */
  refreshHero(): void {
    const section = configSection<CharacterSection>(this.client, "Character");
    const owned = (this.client.data.user.state?.Character?.Characters ??
      {}) as Record<string, HeroModelView | undefined>;
    const id = pickHero(section, owned, this.selectedID);
    this.income = pickIncome(
      configSection<RewardSection>(this.client, "Reward"),
    );
    const items = itemDefinitions(
      configSection<ItemSection>(this.client, "Item"),
    ) as unknown as Map<string, GearDefView & GearDefinition>;
    const instances = (
      this.client.data.user.state?.InventoryV2 as
        | {
            UnstackableItems?: Record<string, GearInstance | null>;
          }
        | undefined
    )?.UnstackableItems;
    this.gearItems = ownedGear(instances, items, attestedGrindAssignments(this.grindEquipment, owned));
    const instanceLevels: Record<string, number> = {};
    for (const [k, inst] of Object.entries(instances ?? {}))
      if (inst?.Level) instanceLevels[k] = inst.Level;
    this.roster = Object.entries(section?.Definitions ?? {}).flatMap(([heroID, definition]) => {
      if (!definition || !isPlayableHeroID(heroID)) return [];
      // Native Character.EquipItems can be called directly. Strip its equipment before any
      // Grind stat or Power calculation, then apply only protected Grind assignments.
      const model = owned[heroID] ? { ...owned[heroID], Equipment: {} } : undefined;
      const input: HeroInput = { section, def: definition, model, items, instanceLevels };
      const baseFighter = fighterStats(input);
      const gear = totalBonuses(this.gearItems, heroID);
      const fighter = grindFighterStats(baseFighter, gear);
      const stageStats = stageHeroStats(baseFighter, heroArchetype(heroID), gear);
      return [{
        id: heroID, name: definition.Identity?.DisplayName ?? heroID,
        classID: definition.Classification?.ClassID ?? "",
        rarity: definition.Classification?.RarityID ?? "",
        rank: heroRank(input), power: combatPower(stageStats),
        level: heroProgress(this.heroProgressMap[heroID]).level,
        xp: heroProgress(this.heroProgressMap[heroID]).xp,
        def: definition, input, stats: resolveStats(section, definition), fighter, baseFighter,
      }];
    });
    this.hero = this.roster.find((entry) => entry.id === id) ?? null;
    if (this.hero) this.battle.setStats(this.hero.fighter);
    const ownedIDs = this.ownedHeroIDs();
    if (!validateFormation(this.formation, ownedIDs, this.capacity))
      this.formation = defaultFormation(ownedIDs);
    this.syncParty();
    this.queueTeamPowerRefresh();
    this.changed();
  }

  /** Reconcile cross-account market sales when returning to the game panels. */
  refreshOwnership(): Promise<void> {
    if (this.ownershipRefresh) return this.ownershipRefresh;
    this.ownershipRefresh = (async () => {
      await Promise.allSettled([
        this.client.user.getUserInventory(),
        this.client.character.getUserCharacters(),
      ]);
      try { this.grindEquipment = await this.equipmentService.load(); }
      catch (error) { this.equipmentError = error instanceof Error ? error.message : String(error); }
      this.refreshHero();
    })().finally(() => { this.ownershipRefresh = null; });
    return this.ownershipRefresh;
  }

  ownedHeroIDs(): Set<string> {
    return new Set(this.roster.filter((entry) => entry.rank > 0).map((entry) => entry.id));
  }

  recruitCost(heroID: string): number | null {
    const hero = this.roster.find((entry) => entry.id === heroID);
    return hero ? heroRecruitCost(hero.def) : null;
  }

  async recruitHero(heroID: string): Promise<boolean> {
    if (this.recruitBusy || !RECRUITABLE_HERO_IDS.includes(heroID as "Archer" | "Mage")) return false;
    const cost = this.recruitCost(heroID);
    this.recruitError = null;
    if (this.ownedHeroIDs().has(heroID)) this.recruitError = "Hero already recruited";
    else if (cost === null) this.recruitError = "Recruitment unavailable";
    else if (this.balance(GOLD_CURRENCY_ID) < cost) this.recruitError = "Not enough Gold";
    if (this.recruitError) { this.changed(); return false; }
    this.recruitBusy = true;
    this.changed();
    try {
      const result = await this.client.character.unlockCharacter(heroID);
      if (!result.ok) throw new Error(String(result.error ?? result.reason));
      const [characters, inventory] = await Promise.all([
        this.client.character.getUserCharacters(), this.client.user.getUserInventory(),
      ]);
      if (!characters.ok || !inventory.ok) throw new Error("Recruitment refresh failed");
      this.refreshHero();
      return this.ownedHeroIDs().has(heroID);
    } catch (error) {
      this.recruitError = String(error).toLowerCase().includes("insufficient") ? "Not enough Gold" :
        error instanceof Error ? error.message : String(error);
      return false;
    } finally {
      this.recruitBusy = false;
      this.changed();
    }
  }

  async unlockPartySlot(slot: 2 | 3): Promise<boolean> {
    if (this.slotPurchaseBusy) return false;
    const cost = this.slotCosts?.[slot];
    this.slotPurchaseError = null;
    if (slot !== this.capacity + 1) this.slotPurchaseError = "Unlock the previous slot first";
    else if (!cost) this.slotPurchaseError = "Slot purchase unavailable";
    else if (this.balance(GOLD_CURRENCY_ID) < cost) this.slotPurchaseError = "Not enough Gold";
    if (this.slotPurchaseError) { this.changed(); return false; }
    this.slotPurchaseBusy = true;
    this.changed();
    try {
      const result = await this.client.cloudCode.execute("unlockPartySlot", { slot });
      if (!result.ok || result.data.Error) throw new Error(String(result.ok ? result.data.Error?.Message : result.error ?? result.reason));
      const payload = result.data.FunctionResult as { unlocked?: boolean; reason?: string } | null;
      if (!payload?.unlocked) throw new Error(payload?.reason === "not_enough_gold" ? "Not enough Gold" :
        payload?.reason ?? "Slot purchase failed");
      const [data, inventory] = await Promise.all([
        this.client.userCustomData.getMyUserCustomData(), this.client.user.getUserInventory(),
      ]);
      if (!data.ok || !inventory.ok) throw new Error("Slot purchase refresh failed");
      this.capacity = partyCapacity(data.data.ReadOnly?.[PARTY_CAPACITY_KEY]?.Value);
      this.syncParty();
      return this.capacity >= slot;
    } catch (error) {
      this.slotPurchaseError = error instanceof Error ? error.message : String(error);
      return false;
    } finally {
      this.slotPurchaseBusy = false;
      this.changed();
    }
  }

  get activeCapacity(): 1 | 2 | 3 { return this.previewCapacity ?? this.capacity; }
  get isDevPreview(): boolean { return this.previewCapacity !== null; }
  get devPreviewAvailable(): boolean { return import.meta.env.DEV && this.client.titleID.endsWith("-DEV"); }
  get activeFormation(): Formation { return this.previewFormation ?? this.formation; }
  get partyPower(): number { return this.run.heroes.reduce((sum, hero) => sum + combatPower(hero), 0); }

  private queueTeamPowerRefresh(force = false): void {
    if (!this.loaded || this.isDevPreview) return;
    const signature = JSON.stringify({ formation: this.formation.slots, capacity: this.capacity,
      powers: this.roster.map((hero) => [hero.id, hero.rank, hero.power]),
      gear: this.gearItems.filter((item) => item.equippedBy)
        .map((item) => [item.instanceID, item.equippedBy?.heroID, item.level, item.bonuses]) });
    if (!force && signature === this.teamPowerSignature) return;
    this.teamPowerSignature = signature;
    this.teamPowerRevision++;
    if (this.teamPowerTimer) clearTimeout(this.teamPowerTimer);
    this.teamPowerTimer = setTimeout(() => { this.teamPowerTimer = null; void this.refreshTeamPower(); }, 350);
  }

  async refreshTeamPower(): Promise<void> {
    if (this.teamPowerRefresh) return this.teamPowerRefresh;
    const revision = this.teamPowerRevision;
    this.teamPowerRefresh = (async () => {
      try {
        const value = await this.teamPowerService.refresh();
        this.teamPower = value.power;
        this.teamPowerError = null;
      } catch (error) {
        this.teamPowerError = error instanceof Error ? error.message : String(error);
      } finally { this.changed(); }
    })().finally(() => {
      this.teamPowerRefresh = null;
      if (this.teamPowerRevision !== revision) this.queueTeamPowerRefresh(true);
    });
    return this.teamPowerRefresh;
  }

  async loadTeamLeaderboard(): Promise<void> {
    if (this.teamLeaderboardBusy) return;
    this.teamLeaderboardBusy = true;
    this.changed();
    try {
      this.teamLeaderboard = await this.teamPowerService.leaderboard();
      this.teamPower = this.teamLeaderboard.power;
      this.teamPowerError = null;
    } catch (error) {
      this.teamPowerError = error instanceof Error ? error.message : String(error);
    } finally { this.teamLeaderboardBusy = false; this.changed(); }
  }

  heroPower(heroID: string): number {
    const stats = this.heroCombatStats(heroID);
    return stats ? combatPower(stats) : 0;
  }

  heroCombatStats(heroID: string) {
    const entry = this.roster.find((candidate) => candidate.id === heroID);
    if (!entry) return null;
    return stageHeroStats(entry.baseFighter, heroArchetype(heroID),
      totalBonuses(this.gearItems, heroID));
  }

  equipmentProblems(item: GearItem, heroID: string): string[] {
    if (!this.equipmentReady) return ["Equipment is loading"];
    const entry = this.roster.find((candidate) => candidate.id === heroID);
    if (!entry) return ["Unknown hero"];
    return equipProblems(item, heroID, entry.level, entry.rank > 0,
      new Set(Object.keys(entry.def.Equipment?.Slots ?? {})));
  }

  equipmentProblem(item: GearItem, heroID: string): string | null {
    return this.equipmentProblems(item, heroID).join(" · ") || null;
  }

  async equipGear(instanceID: string, heroID: string): Promise<void> {
    if (this.equipmentBusy || !this.equipmentReady) return;
    const item = this.gearItems.find((candidate) => candidate.instanceID === instanceID);
    if (!item) return;
    const problem = this.equipmentProblem(item, heroID);
    if (problem) { this.equipmentError = problem; return this.changed(); }
    this.equipmentBusy = true;
    this.equipmentError = null;
    this.changed();
    const request = this.equipmentService.equip(heroID, item.slot, instanceID);
    this.managementWrites.add(request);
    try {
      this.grindEquipment = await request;
      this.managementRevision++;
      this.stagePartyDirty = true;
    } catch (error) {
      this.equipmentError = error instanceof Error ? error.message : String(error);
      try {
        this.grindEquipment = await this.equipmentService.load();
        this.managementRevision++;
        this.stagePartyDirty = true;
      } catch { /* Keep the original operation error; a later refresh retries. */ }
    } finally {
      this.managementWrites.delete(request);
      this.equipmentBusy = false;
      this.refreshHero();
    }
  }

  async unequipGear(heroID: string, slot: GearSlot): Promise<void> {
    if (this.equipmentBusy || !this.equipmentReady) return;
    if (!equippedIn(this.gearItems, heroID, slot)) return;
    this.equipmentBusy = true;
    this.equipmentError = null;
    this.changed();
    const request = this.equipmentService.unequip(heroID, slot);
    this.managementWrites.add(request);
    try {
      this.grindEquipment = await request;
      this.managementRevision++;
      this.stagePartyDirty = true;
    } catch (error) {
      this.equipmentError = error instanceof Error ? error.message : String(error);
      try {
        this.grindEquipment = await this.equipmentService.load();
        this.managementRevision++;
        this.stagePartyDirty = true;
      } catch { /* Keep the original operation error; a later refresh retries. */ }
    } finally {
      this.managementWrites.delete(request);
      this.equipmentBusy = false;
      this.refreshHero();
    }
  }

  async equipBestGear(heroID: string): Promise<void> {
    if (this.equipmentBusy || !this.equipmentReady) return;
    const entry = this.roster.find((candidate) => candidate.id === heroID);
    if (!entry) return;
    const best: Partial<Record<GearSlot, GearItem>> = {};
    const score = (item: GearItem) => item.requiredLevel * 1_000_000 +
      item.bonuses.attack * 200 + item.bonuses.maxHp * 10 +
      item.bonuses.defence * 300 + item.bonuses.attackSpeed * 2000 +
      item.bonuses.moveSpeed * 20 + item.level;
    for (const item of this.gearItems) {
      if (item.equippedBy && item.equippedBy.heroID !== heroID) continue;
      const problems = this.equipmentProblems(item, heroID)
        .filter((problem) => problem !== "Already equipped");
      if (problems.length) continue;
      if (!best[item.slot] || score(item) > score(best[item.slot]!)) best[item.slot] = item;
    }
    const slots = Object.fromEntries(Object.entries(best)
      .map(([slot, item]) => [slot, item.instanceID])) as Partial<Record<GearSlot, string>>;
    this.equipmentBusy = true;
    this.equipmentError = null;
    this.changed();
    const request = this.equipmentService.equipBest(heroID, slots);
    this.managementWrites.add(request);
    try {
      this.grindEquipment = await request;
      this.managementRevision++;
      this.stagePartyDirty = true;
    } catch (error) {
      this.equipmentError = error instanceof Error ? error.message : String(error);
    } finally {
      this.managementWrites.delete(request);
      this.equipmentBusy = false;
      this.refreshHero();
    }
  }

  /** A local-only battle preview; it never changes character or party unlock data. */
  setDevPreview(capacity: 1 | 2 | 3 | null): void {
    if (!this.devPreviewAvailable) return;
    if (capacity !== null && this.previewCapacity === null)
      this.previewReturnStageID = this.run.stage.id;
    const returnStage = capacity === null && this.previewCapacity !== null
      ? this.previewReturnStageID : null;
    this.previewCapacity = capacity;
    const ids = ["Knight", "Archer", "Mage"].filter((heroID) => this.roster.some((entry) => entry.id === heroID));
    this.previewFormation = capacity === null ? null : {
      version: 2, slots: [ids[0] ?? null, capacity >= 2 ? ids[1] ?? null : null,
        capacity >= 3 ? ids[2] ?? null : null],
    };
    this.syncParty();
    this.changed();
    if (returnStage) {
      this.previewReturnStageID = null;
      this.selectStage(stageUnlocked(this.stageProgress, returnStage) ? returnStage :
        farmingStageID(null, this.stageProgress), true);
    }
  }

  previewStage(stageID: string): void {
    if (!this.devPreviewAvailable || !stageByID(stageID)) return;
    this.setDevPreview(3);
    this.selectStage(stageID);
  }

  async assignHero(slot: SlotIndex, heroID: string | null): Promise<void> {
    if (this.formationBusy) return;
    const owned = this.isDevPreview
      ? new Set(this.roster.map((entry) => entry.id)) : this.ownedHeroIDs();
    const next = assignFormation(this.activeFormation, slot, heroID, owned, this.activeCapacity);
    if (!next) {
      this.formationError = "Hero unavailable, slot locked, duplicate, or party would be empty.";
      return this.changed();
    }
    if (this.isDevPreview) {
      this.previewFormation = next;
      this.formationError = null;
      this.syncParty();
      return this.changed();
    }
    this.formationBusy = true;
    this.formationError = null;
    this.changed();
    const request = this.client.userCustomData.setPrivateData(FORMATION_KEY, JSON.stringify(next));
    this.managementWrites.add(request);
    const result = await request;
    this.managementWrites.delete(request);
    this.formationBusy = false;
    if (result.ok) {
      this.formation = next;
      this.formationStored = true;
      this.managementRevision++;
      this.stagePartyDirty = true;
      this.syncParty();
      this.queueTeamPowerRefresh();
      if (this.serverRunId) {
        const sync = this.stageService.syncParty(this.serverRunId);
        this.managementWrites.add(sync);
        try { await sync; }
        catch (error) { this.stagePartyDirty = true; this.formationError = `Party sync: ${String(error)}`; }
        finally { this.managementWrites.delete(sync); }
      }
    } else this.formationError = String(result.error ?? result.reason);
    this.changed();
  }

  /** Character ownership and slot capacity are checked independently. */
  private syncParty(): void {
    const slots: PartySlot[] = ([1, 2, 3] as const).map((index) => {
      const heroID = this.activeFormation.slots[index - 1];
      const entry = this.roster.find((candidate) => candidate.id === heroID);
      const usable = entry && (entry.rank > 0 || this.isDevPreview) ? entry : null;
      const archetype = usable ? heroArchetype(usable.id) : null;
      const final = usable && archetype ? stageHeroStats(usable.baseFighter, archetype,
        totalBonuses(this.gearItems, usable.id)) : null;
      return { index, unlocked: index <= this.activeCapacity, hero: usable && archetype ? {
        id: usable.id, classId: usable.classID, level: Math.max(1, usable.rank),
        ...final!, combatType: archetype.combatType, projectile: archetype.projectile,
      } : null };
    });
    this.run.setSlots(slots);
  }

  /** Gold per second the server pays now (display). */
  ratePerSecond(): number {
    if (!this.income) return 0;
    return incomePerSecond(this.income, this.roster.map((hero) => hero.power));
  }

  balance(currencyID: string): number {
    const vc = this.client.data.user.state?.InventoryV2?.VirtualCurrencies as
      Record<string, { Amount?: number } | undefined> | undefined;
    return Number(vc?.[currencyID]?.Amount ?? 0);
  }

  // ── The clock ──────────────────────────────────────────────────────────────────────────────

  /** One frame of the fight (called by the scene). Returns what happened, for the drawing. */
  tick(dt: number): BattleEvent[] {
    const events = this.battle.tick(dt);
    for (const e of events) {
      if (e.type === "stageCleared") this.stageCleared(e.stage);
      else if (e.type === "bossFailed") this.scheduleSave();
    }
    // The HUD follows at a few frames a second; a turn of the stage shows at once.
    this.hudClock += dt;
    const turn = events.some((e) => TURN_EVENTS.has(e.type));
    if (turn || this.hudClock >= 1 / HUD_HZ) {
      this.hudClock = 0;
      this.changed();
    }
    return events;
  }

  /** The new finite-stage loop, independent of the template's old wave simulation. */
  tickRun(dt: number): RunEvent[] {
    const events = this.run.tick(dt);
    if (this.terminalRun !== this.run && events.some((event) => event.type === "stageCleared")) {
      this.terminalRun = this.run;
      if (this.isDevPreview) {
        this.lootItems = ["DEV preview: no progression or reward"];
        this.pendingContinuationID = this.run.stage.id;
        this.scheduleAutoAdvance();
      }
      else {
        this.lootPending = true;
        void this.claimStageLoot();
      }
    }
    if (this.terminalRun !== this.run && events.some((event) => event.type === "stageFailed")) {
      this.terminalRun = this.run;
      const runId = this.serverRunId;
      const failedRun = this.run;
      const generation = this.runGeneration;
      this.lastClearNotice = "Party defeated";
      if (this.isDevPreview) {
        this.pendingContinuationID = failedRun.stage.id;
        this.scheduleAutoAdvance();
      } else if (runId) {
        const closing = this.closeFailedRun(runId, failedRun, generation);
        this.failureClose = closing;
        void closing.finally(() => { if (this.failureClose === closing) this.failureClose = null; });
      } else {
        this.stageError = "Failed run has no server marker";
      }
    }
    this.hudClock += dt;
    if (events.length > 0 || this.hudClock >= 1 / HUD_HZ) {
      this.hudClock = 0;
      this.changed();
    }
    return events;
  }

  private async closeFailedRun(runId: string, failedRun: StageRun, generation: number): Promise<void> {
    try {
      await this.stageService.fail(runId);
      this.serverRunId = null;
      const progress = await this.stageService.loadProgress();
      if (generation !== this.runGeneration || failedRun !== this.run) return;
      this.stageProgress = progress;
      const wasAdvancingIntoNewStage = this.autoProgressEnabled &&
        (progress.completed[failedRun.stage.id] ?? 0) === 0;
      this.pendingContinuationID = continuationStageID(failedRun.stage.id, "failed", progress,
        progress, this.autoProgressEnabled);
      if (wasAdvancingIntoNewStage) this.autoProgressEnabled = false;
      this.lastClearNotice = this.pendingContinuationID === failedRun.stage.id
        ? "Party defeated · retrying stage"
        : `Party defeated · farming ${this.pendingContinuationID.replace("grind-stage-", "")}`;
      if (wasAdvancingIntoNewStage || this.pendingContinuationID !== failedRun.stage.id)
        this.saveStagePreferences(this.pendingContinuationID);
      this.changed();
      this.scheduleAutoAdvance();
    } catch (error) {
      if (generation === this.runGeneration && failedRun === this.run) {
        this.stageError = `Could not close failed run: ${String(error)}`;
        this.changed();
      }
    }
  }

  selectStage(stageID: string, force = false): boolean {
    if (this.lootPending || this.lootBusy || this.failureClose ||
      (this.run.state === "failed" && this.serverRunId)) return false;
    const stage = stageByID(stageID);
    if (!stage || !(this.isDevPreview || stageUnlocked(this.stageProgress, stageID))) return false;
    if (stageID === this.run.stage.id && !force) {
      if (this.autoProgressEnabled) {
        this.autoProgressEnabled = false;
        if (!this.isDevPreview) this.saveStagePreferences();
        this.changed();
      }
      return true;
    }
    this.cancelAutoAdvance();
    this.pendingContinuationID = null;
    if (!force) this.autoProgressEnabled = false;
    const oldRunID = this.serverRunId;
    this.serverRunId = null;
    const generation = ++this.runGeneration;
    this.run = new StageRun(stage);
    this.run.bestClearSeconds = this.stageProgress.bestSeconds[stageID] ?? null;
    this.validatedClearSeconds = null;
    this.previousBestSeconds = null;
    this.lootItems = [];
    this.lootError = null;
    this.stageError = null;
    this.lastClearNotice = null;
    this.syncParty();
    if (!this.isDevPreview) this.saveStagePreferences();
    this.changed();
    void (async () => {
      if (this.startRequest) await this.startRequest;
      if (oldRunID) {
        try { await this.stageService.fail(oldRunID); }
        catch (error) { this.stageError = `Could not close abandoned run: ${String(error)}`; }
      }
      if (generation !== this.runGeneration) return;
      void this.startRun();
    })().catch((error: unknown) => {
      this.stageError = `Stage switch: ${String(error)}`;
      this.changed();
      if (generation === this.runGeneration) void this.startRun();
    });
    return true;
  }

  get nextStageID(): string | null {
    const index = STAGE_CATALOG.findIndex((stage) => stage.id === this.run.stage.id);
    const next = STAGE_CATALOG[index + 1];
    return next && stageUnlocked(this.stageProgress, next.id) ? next.id : null;
  }

  setAutoProgressEnabled(enabled: boolean): void {
    if (enabled === this.autoProgressEnabled) return;
    this.autoProgressEnabled = enabled;
    if (this.run.state === "clear" && !this.lootPending && !this.lootBusy) {
      const nextID = this.nextStageID;
      this.pendingContinuationID = enabled && nextID ? nextID : this.run.stage.id;
      this.scheduleAutoAdvance();
    }
    this.saveStagePreferences();
    this.changed();
  }

  async startRun(): Promise<boolean> {
    if (this.startRequest) return this.startRequest;
    const request = this.beginRun();
    this.startRequest = request;
    try { return await request; }
    finally { if (this.startRequest === request) this.startRequest = null; }
  }

  private async beginRun(): Promise<boolean> {
    if (!this.loaded || !this.equipmentReady || this.runStartBusy || this.lootPending || this.lootBusy ||
      this.failureClose || this.run.state !== "ready" || this.serverRunId ||
      !(this.isDevPreview || stageUnlocked(this.stageProgress, this.run.stage.id))) return false;
    while (this.managementWrites.size)
      await Promise.allSettled([...this.managementWrites]);
    const startRevision = this.managementRevision;
    const generation = this.runGeneration;
    const stageID = this.run.stage.id;
    this.syncParty();
    if (this.run.heroes.length === 0) return false;
    this.runStartBusy = true;
    this.stageError = null;
    this.lootError = null;
    this.changed();
    try {
      if (!this.isDevPreview) {
        const started = await this.stageService.start(stageID);
        if (generation !== this.runGeneration) {
          await this.stageService.fail(started.runId);
          return false;
        }
        this.serverRunId = started.runId;
      }
      const started = this.run.start();
      if (!started) {
        if (this.serverRunId) void this.stageService.fail(this.serverRunId).catch(() => {});
        this.serverRunId = null;
        return false;
      }
      this.previousBestSeconds = this.stageProgress.bestSeconds[this.run.stage.id] ?? null;
      this.stagePartyDirty = this.managementRevision !== startRevision;
      this.validatedClearSeconds = null;
      this.lootItems = [];
      this.lootGold = 0;
      return true;
    } catch (error) {
      this.stageError = error instanceof Error ? error.message : String(error);
      if (this.autoFlowEnabled && generation === this.runGeneration)
        this.autoAdvanceTimer = setTimeout(() => { this.autoAdvanceTimer = null; void this.startRun(); }, 2500);
      return false;
    } finally {
      this.runStartBusy = false;
      this.changed();
    }
  }

  private cancelAutoAdvance(): void {
    if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
    this.autoAdvanceTimer = null;
  }

  private prepareContinuation(targetID: string): boolean {
    const next = stageByID(targetID);
    if (!next || !(this.isDevPreview || stageUnlocked(this.stageProgress, targetID))) return false;
    const previousID = this.run.stage.id;
    this.runGeneration++;
    this.pendingContinuationID = null;
    this.run = new StageRun(next);
    this.run.bestClearSeconds = this.stageProgress.bestSeconds[targetID] ?? null;
    this.syncParty();
    if (!this.isDevPreview && targetID !== previousID) this.saveStagePreferences();
    this.changed();
    return true;
  }

  private scheduleAutoAdvance(): void {
    if (!this.autoFlowEnabled || !this.pendingContinuationID ||
      this.lootPending || this.lootBusy || this.failureClose && this.serverRunId) return;
    this.cancelAutoAdvance();
    const stageID = this.run.stage.id;
    const targetID = this.pendingContinuationID;
    const generation = this.runGeneration;
    this.autoAdvanceTimer = setTimeout(() => { void (async () => {
      this.autoAdvanceTimer = null;
      if (!this.autoFlowEnabled || generation !== this.runGeneration ||
          this.pendingContinuationID !== targetID ||
          this.lootPending || this.lootBusy || this.failureClose && this.serverRunId ||
          !["clear", "failed"].includes(this.run.state)) return;
      const reward = this.isDevPreview ? "DEV preview" :
        `+${this.lootGold} GOLD${this.lootItems.length ? ` · ${this.lootItems.join(", ")}` : ""}`;
      if (this.run.state === "clear") {
        this.lastClearNotice = `${stageID.replace("grind-stage-", "")} clear · ${reward}`;
        const notice = this.lastClearNotice;
        setTimeout(() => {
          if (this.lastClearNotice === notice) {
            this.lastClearNotice = null;
            this.changed();
          }
        }, 3500);
      }
      if (generation !== this.runGeneration) return;
      if (this.prepareContinuation(targetID)) void this.startRun();
    })().catch((error: unknown) => {
      this.stageError = `Stage retry: ${String(error)}`;
      this.changed();
    }); }, this.run.state === "failed" ? 1200 : 850);
  }

  private saveStagePreferences(selectedStageID = this.run.stage.id): void {
    if (!this.loaded) return;
    const value = JSON.stringify({ selectedStageID, autoProgressMode: this.autoProgressEnabled });
    this.preferenceWrites = this.preferenceWrites.then(async () => {
      const result = await this.client.userCustomData.setPrivateData(STAGE_PREFERENCES_KEY, value);
      if (!result.ok) {
        this.stageError = `Stage preference save: ${String(result.error ?? result.reason)}`;
        this.changed();
      }
    });
  }

  chestCount(itemID: string): number {
    const suffixes = itemID === "stage_chest" || itemID === "boss_chest"
      ? chestIDs(itemID) : [itemID];
    return suffixes.reduce((total, id) => total +
      Number(this.client.data.user.state?.InventoryV2?.Items?.[id]?.StackableAmount ?? 0), 0);
  }

  chestConfigured(itemID: "stage_chest" | "boss_chest"): boolean {
    const definitions = configSection<{ Definitions?: Record<string, unknown> }>(this.client, "Lootbox")?.Definitions;
    return !!definitions?.[itemID === "stage_chest" ? "gear_summon" : "boss_summon"];
  }

  async openChest(itemID: "stage_chest" | "boss_chest"): Promise<void> {
    if (this.lootBusy || !this.chestConfigured(itemID) || this.chestCount(itemID) < 1) return;
    const definitions = configSection<{ Definitions?: Record<string, unknown> }>(this.client, "Lootbox")?.Definitions ?? {};
    const counts = Object.fromEntries(chestIDs(itemID).map((id) =>
      [id, Number(this.client.data.user.state?.InventoryV2?.Items?.[id]?.StackableAmount ?? 0)]));
    // Spend the highest Act chest first; legacy stacks remain openable through Act 1 pools.
    const option = chestPool(itemID, counts, definitions);
    if (!option) return;
    this.lootBusy = true;
    this.lootError = null;
    this.lootItems = [];
    this.chestDrop = null;
    if (this.chestDropTimer) clearTimeout(this.chestDropTimer);
    this.chestDropTimer = null;
    const before = new Set(Object.keys(this.itemInstances()));
    this.changed();
    try {
      const opened = await this.client.lootbox.open(option.lootboxID, 1, option.priceID);
      if (!opened.ok) throw new Error(String(opened.error ?? opened.reason));
      const rewardItemID = chestRewardItemID(opened.data);
      const itemDefs = itemDefinitions(configSection<ItemSection>(this.client, "Item")) as unknown as
        ReadonlyMap<string, GearDefinition>;
      let awarded = chestRewardPreview(rewardItemID, itemDefs);
      const presented = !!awarded;
      // The server roll is authoritative. Show it now rather than waiting for InventoryV2
      // to catch up, which can take several reads on a hosted build.
      if (awarded) this.showChestDrop(awarded);
      let refreshError: string | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const inventory = await this.client.user.getUserInventory();
          if (!inventory.ok) refreshError = String(inventory.error ?? inventory.reason);
          else {
            refreshError = null;
            this.refreshHero();
            const fresh = newlyGrantedGear(this.gearItems, before, rewardItemID);
            awarded = fresh ?? awarded;
            if (fresh) break;
          }
        } catch (error) { refreshError = error instanceof Error ? error.message : String(error); }
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
      }
      this.lootItems = awarded ? [] : ["Chest opened · check Inventory"];
      if (refreshError) this.lootError = `Inventory refresh delayed: ${refreshError}`;
      if (awarded && !presented) this.showChestDrop(awarded);
    } catch (error) {
      this.lootError = error instanceof Error ? error.message : String(error);
      // A rejected request can still have changed inventory server-side. Refresh the count.
      try {
        const refreshed = await this.client.user.getUserInventory();
        if (!refreshed.ok) this.lootError += ` · Inventory refresh: ${String(refreshed.error ?? refreshed.reason)}`;
        this.refreshHero();
      } catch { /* Preserve the original error; the next inventory event refreshes the count. */ }
    } finally {
      this.lootBusy = false;
      this.changed();
      if (this.lootPending) void this.claimStageLoot();
    }
  }

  private showChestDrop(item: GearItem): void {
    const sequence = ++this.chestDropSequence;
    this.chestDrop = { item, sequence };
    if (this.chestDropTimer) clearTimeout(this.chestDropTimer);
    this.chestDropTimer = setTimeout(() => {
      if (this.chestDrop?.sequence === sequence) {
        this.chestDrop = null;
        this.changed();
      }
      this.chestDropTimer = null;
    }, 3600);
    this.changed();
  }

  /** CloudCode validates a server run before any configured reward reaches InventoryV2. */
  async claimStageLoot(): Promise<void> {
    if (!this.lootPending || this.lootBusy || this.run.state !== "clear" || this.isDevPreview) return;
    this.lootBusy = true;
    this.lootError = null;
    this.changed();
    try {
      if (this.serverRunId) {
        while (this.managementWrites.size)
          await Promise.allSettled([...this.managementWrites]);
        if (this.stagePartyDirty) {
          await this.stageService.syncParty(this.serverRunId);
          this.stagePartyDirty = false;
        }
        const completed = await this.stageService.complete(this.run.stage.id, this.serverRunId);
        this.serverRunId = null;
        const before = this.stageProgress;
        this.stageProgress = completed.progress;
        this.pendingContinuationID = continuationStageID(this.run.stage.id, "clear", before,
          completed.progress, this.autoProgressEnabled);
        this.validatedClearSeconds = completed.serverSeconds;
        this.lootGold = completed.rewards.gold;
        this.run.bestClearSeconds = completed.progress.bestSeconds[this.run.stage.id] ?? null;
        this.heroProgressMap = completed.heroProgress;
        this.refreshHero();
        const levelUps = completed.xpAwards.filter((award) => award.level > award.previousLevel);
        if (levelUps.length) {
          this.lastLevelNotice = levelUps.map((award) => `${award.heroID} Level Up! Lv ${award.level}`).join(" · ");
          const notice = this.lastLevelNotice;
          setTimeout(() => { if (this.lastLevelNotice === notice) { this.lastLevelNotice = null; this.changed(); } }, 3500);
        }
        this.changed();
      }
      const inventory = await this.client.user.getUserInventory();
      if (!inventory.ok) throw new Error(`Inventory refresh: ${String(inventory.error ?? inventory.reason)}`);
      this.lootItems = ["+1 stage chest"];
      if (this.run.stage.rewards?.repeat.bossChestItemID) this.lootItems.push("+1 boss chest");
      this.lootPending = false;
    } catch (error) {
      this.lootError = error instanceof Error ? error.message : String(error);
      if (this.autoFlowEnabled) setTimeout(() => void this.claimStageLoot(), 1800);
    }
    this.lootBusy = false;
    this.changed();
    if (!this.lootPending) this.scheduleAutoAdvance();
  }

  private itemInstances(): Record<string, GearInstance | null> {
    return (this.client.data.user.state?.InventoryV2?.UnstackableItems ?? {}) as
      Record<string, GearInstance | null>;
  }

  /** The mode is on screen: collect what the hero earned meanwhile, then keep collecting. */
  activate(): void {
    this.autoFlowEnabled = true;
    if (this.loaded && this.run.state === "ready") void this.startRun();
    if (["clear", "failed"].includes(this.run.state)) this.scheduleAutoAdvance();
    void this.collect();
    this.collectTimer ??= setInterval(
      () => void this.collect(),
      COLLECT_EVERY_MS,
    );
  }

  suspend(): void {
    this.autoFlowEnabled = false;
    this.cancelAutoAdvance();
    if (this.collectTimer) clearInterval(this.collectTimer);
    this.collectTimer = null;
    // The finite V1 run is transient. Do not write the legacy wave-stage key
    // merely because the player opened or left this new mode.
  }

  destroy(): void {
    this.runGeneration++;
    this.cancelAutoAdvance();
    this.suspend();
    if (this.teamPowerTimer) clearTimeout(this.teamPowerTimer);
    if (this.chestDropTimer) clearTimeout(this.chestDropTimer);
    for (const off of this.offClient) off();
    this.offClient = [];
    this.listeners.clear();
  }

  // ── Income ─────────────────────────────────────────────────────────────────────────────────

  async collect(): Promise<void> {
    const income = this.income;
    if (!income || this.collecting) return;
    this.collecting = true;
    const first = this.firstCollect;
    this.firstCollect = false;
    const res = await this.client.reward.collectIdleAccrual(income.accrualID);
    this.collecting = false;
    // "Too soon" / "Nothing to collect yet" are the normal answers between collects — not errors.
    if (!res.ok) return;
    const amount = Number(res.data.IdleState?.LastClaimedAmount ?? 0);
    const seconds = Number(res.data.AccruedSeconds ?? 0);
    if (amount <= 0) return;
    this.lastCollect = { amount, at: Date.now() };
    if (first && seconds >= AWAY_MIN_SECONDS)
      this.away = { amount, seconds, currencyID: income.currencyID };
    this.changed();
  }

  dismissAway(): void {
    this.away = null;
    this.changed();
  }

  // ── Enhance ────────────────────────────────────────────────────────────────────────────────

  /**
   * Add `levels` to a stat. Taps while a request is out are added up and sent as ONE call when it
   * returns — so holding the button never floods the server (and the per-player rate limit).
   */
  enhance(statID: string, levels: number): void {
    const q = this.enhanceQueue.get(statID) ?? { pending: 0, busy: false };
    q.pending += Math.max(1, Math.floor(levels));
    this.enhanceQueue.set(statID, q);
    void this.pumpEnhance(statID);
  }

  /** What `levels` more would really buy now: limited by the cap and the balance. */
  plan(statID: string, levels: number): { levels: number; cost: number } {
    const hero = this.hero;
    const stat = hero?.stats.find((s) => s.id === statID);
    if (!hero || !stat?.price) return { levels: 0, cost: 0 };
    const level = Number(hero.input.model?.StatLevels?.[statID] ?? 0);
    return affordableLevels(
      stat,
      level,
      statCap(stat, Math.max(1, hero.rank), hero.def),
      this.balance(stat.price.currencyID),
      levels,
    );
  }

  private async pumpEnhance(statID: string): Promise<void> {
    const q = this.enhanceQueue.get(statID);
    const hero = this.hero;
    if (!q || q.busy || q.pending <= 0 || !hero) return;
    const { levels } = this.plan(statID, q.pending);
    if (levels <= 0) {
      q.pending = 0;
      const stat = hero.stats.find((s) => s.id === statID);
      if (stat?.price)
        this.notify({ kind: "notEnough", currencyID: stat.price.currencyID });
      return;
    }
    q.busy = true;
    const res = await this.client.character.upgradeStatLevel(hero.id, statID, {
      levels,
    });
    q.busy = false;
    if (!res.ok) {
      q.pending = 0;
      this.notify({ kind: "error", text: String(res.error ?? "") });
      return;
    }
    q.pending = Math.max(0, q.pending - levels);
    this.report(METRIC_STAT_ENHANCED, levels);
    void this.pumpEnhance(statID);
  }

  private notify(notice: Notice): void {
    this.notice = { ...notice, at: Date.now() };
    this.changed();
  }

  // ── Progress ───────────────────────────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    const res = await this.client.userCustomData.getMyUserCustomData();
    const raw = res.ok ? (res.data.Private?.[PROGRESS_KEY]?.Value ?? null) : this.readProgress();
    const saved = parseProgress(raw ?? null);
    if (saved) this.battle.setStage(saved.stage, saved.best);
    if (res.ok) {
      this.stageProgress = parseStageProgress(res.data.ReadOnly?.[STAGE_PROGRESS_KEY]?.Value);
      this.heroProgressMap = parseHeroProgress(res.data.ReadOnly?.[HERO_XP_KEY]?.Value);
      try {
        this.grindEquipment = await this.equipmentService.load();
        this.equipmentReady = true;
        this.equipmentError = null;
      } catch (error) {
        this.equipmentReady = false;
        this.equipmentError = error instanceof Error ? error.message : String(error);
        this.stageError = `Equipment load: ${this.equipmentError}`;
      }
      this.refreshHero();
      try {
        const preferences = JSON.parse(res.data.Private?.[STAGE_PREFERENCES_KEY]?.Value ?? "{}");
        this.run = new StageRun(stageByID(farmingStageID(preferences.selectedStageID, this.stageProgress))!);
        this.autoProgressEnabled = typeof preferences.autoProgressMode === "boolean"
          ? preferences.autoProgressMode : (this.stageProgress.completed[this.run.stage.id] ?? 0) === 0;
      } catch { /* Invalid optional preferences fall back to the first stage. */ }
      this.run.bestClearSeconds = this.stageProgress.bestSeconds[this.run.stage.id] ?? null;
      this.capacity = partyCapacity(res.data.ReadOnly?.[PARTY_CAPACITY_KEY]?.Value);
      const prices = await this.client.cloudCode.execute("getPartySlotPrices", {});
      if (prices.ok && !prices.data.Error) {
        const costs = prices.data.FunctionResult as { slot2?: number; slot3?: number } | null;
        if (Number.isSafeInteger(costs?.slot2) && Number.isSafeInteger(costs?.slot3))
          this.slotCosts = { 2: Number(costs!.slot2), 3: Number(costs!.slot3) };
      }
      const savedFormation = res.data.Private?.[FORMATION_KEY]?.Value;
      const ownedHeroes = this.ownedHeroIDs();
      this.formation = restoreFormation(savedFormation, ownedHeroes, this.capacity);
      this.formationStored = Number(res.data.Private?.[FORMATION_KEY]?.Version ?? 0) > 0;
      this.syncParty();
      let savedFormationValid = false;
      try { savedFormationValid = validateFormation(JSON.parse(savedFormation ?? "null"), ownedHeroes, this.capacity); }
      catch { /* Repair malformed saved formations on load. */ }
      if ((!this.formationStored || !savedFormationValid) && this.formation.slots.some(Boolean)) {
        const initial = await this.client.userCustomData.setPrivateData(FORMATION_KEY,
          JSON.stringify(this.formation));
        this.formationStored = initial.ok;
        if (!initial.ok) this.formationError = `Formation save: ${String(initial.error ?? initial.reason)}`;
      }
    } else {
      this.formationError = `Formation load: ${String(res.error ?? res.reason)}`;
      this.stageError = `Stage progress load: ${String(res.error ?? res.reason)}`;
    }
    this.loaded = true;
    this.queueTeamPowerRefresh(true);
    this.changed();
    if (this.autoFlowEnabled) void this.startRun();
  }

  /** `undefined` — the login state did not bring the custom data at all (ask once). */
  private readProgress(): string | null | undefined {
    const cd = this.client.data.user.state?.CustomData as
      | { Private?: Record<string, { Value?: string | null } | undefined> }
      | null
      | undefined;
    if (!cd?.Private) return undefined;
    return cd.Private[PROGRESS_KEY]?.Value ?? null;
  }

  private stageCleared(stage: number): void {
    const info = stageInfo(stage);
    this.callbacks.onStageCleared?.(info.chapter, info.stage);
    this.report(METRIC_STAGE_CLEARED, 1);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), SAVE_DELAY_MS);
  }

  private flushSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.loaded) return;
    const value = serializeProgress({
      stage: this.battle.stage,
      best: this.battle.best,
    });
    if (value === this.readProgress()) return;
    void this.client.userCustomData.setPrivateData(PROGRESS_KEY, value);
  }

  // ── Quest metrics ──────────────────────────────────────────────────────────────────────────

  /** Report a metric to the quests that count it — one call at a time, never above their cap. */
  private report(metricID: string, amount: number): void {
    if (!questMetric(this.questSection(), metricID)) return;
    const q = this.metricQueue.get(metricID) ?? { pending: 0, busy: false };
    q.pending += amount;
    this.metricQueue.set(metricID, q);
    void this.pumpMetric(metricID);
  }

  private async pumpMetric(metricID: string): Promise<void> {
    const q = this.metricQueue.get(metricID);
    const metric = questMetric(this.questSection(), metricID);
    if (!q || q.busy || q.pending <= 0 || !metric) return;
    const chunk =
      metric.maxPerCall > 0
        ? Math.min(q.pending, metric.maxPerCall)
        : q.pending;
    q.busy = true;
    q.pending -= chunk;
    await this.client.quest.addQuestProgress(metricID, chunk);
    q.busy = false;
    void this.pumpMetric(metricID);
  }

  private questSection(): QuestSection | undefined {
    return configSection<QuestSection>(this.client, "Quest");
  }
}

// ── Pure helpers ─────────────────────────────────────────────────────────────────────────────

/**
 * The fighter: the selected hero while it is playable; else the strongest owned hero; else the
 * first hero playable by default (roster order).
 */
export function pickHero(
  section: CharacterSection | undefined,
  owned: Record<string, HeroModelView | undefined>,
  selectedID: string | null,
): string | null {
  const defs = section?.Definitions ?? {};
  const playable = (id: string) =>
    isPlayableHeroID(id) && (Number(owned[id]?.Level ?? 0) > 0 || !!defs[id]?.Unlock?.UnlockedByDefault);
  if (selectedID && defs[selectedID] && playable(selectedID)) return selectedID;
  const strongest = Object.entries(owned)
    .filter(([id, m]) => isPlayableHeroID(id) && defs[id] && Number(m?.Level ?? 0) > 0)
    // Native Character.Power includes native equipment and cannot choose a Grind hero.
    .sort(([, a], [, b]) => Number(b?.Level ?? 0) - Number(a?.Level ?? 0))[0];
  if (strongest) return strongest[0];
  const byOrder = Object.entries(defs)
    .filter(([id, d]) => d && playable(id))
    .sort(
      ([a, x], [b, y]) =>
        Number(x?.Identity?.SortOrder ?? 0) -
          Number(y?.Identity?.SortOrder ?? 0) || a.localeCompare(b),
    )[0];
  return byOrder?.[0] ?? null;
}

export function parseProgress(
  raw: string | null,
): { stage: number; best: number } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { stage?: unknown; best?: unknown };
    const stage = Math.floor(Number(v.stage));
    if (!Number.isFinite(stage) || stage < 1) return null;
    const best = Math.max(stage, Math.floor(Number(v.best)) || stage);
    return { stage, best };
  } catch {
    return null;
  }
}

export function serializeProgress(p: { stage: number; best: number }): string {
  return JSON.stringify({ stage: p.stage, best: p.best });
}
