import type { IDosGamesClient } from "@idosgames/core";
import { GEAR_SLOTS, type GearSlot } from "./equipment.ts";

export const GRIND_EQUIPMENT_KEY = "grind_equipment_v1";
export const GRIND_HERO_IDS = ["Knight", "Archer", "Mage"] as const;

export interface GrindEquipmentState {
  version: 1;
  heroes: Record<string, Record<GearSlot, string | null>>;
}

export interface GrindAssignment { heroID: string; slot: GearSlot }

export function emptyGrindEquipment(): GrindEquipmentState {
  return { version: 1, heroes: Object.fromEntries(GRIND_HERO_IDS.map((heroID) =>
    [heroID, Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, null]))])) as
    Record<string, Record<GearSlot, string | null>> };
}

export function parseGrindEquipment(value: unknown): GrindEquipmentState {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1)
    throw new Error("Invalid Grind equipment state");
  const rawHeroes = (value as { heroes?: unknown }).heroes;
  if (!rawHeroes || typeof rawHeroes !== "object") throw new Error("Invalid Grind equipment heroes");
  const state = emptyGrindEquipment();
  const used = new Set<string>();
  for (const heroID of GRIND_HERO_IDS) {
    const source = (rawHeroes as Record<string, unknown>)[heroID];
    if (!source || typeof source !== "object") throw new Error("Invalid Grind equipment hero");
    for (const slot of GEAR_SLOTS) {
      const id = (source as Record<string, unknown>)[slot];
      if (id === null) continue;
      if (typeof id !== "string" || !id || used.has(id))
        throw new Error("Invalid Grind equipment instance");
      used.add(id);
      state.heroes[heroID]![slot] = id;
    }
  }
  return state;
}

export function grindAssignments(state: GrindEquipmentState): Record<string, GrindAssignment> {
  const result: Record<string, GrindAssignment> = {};
  for (const heroID of GRIND_HERO_IDS)
    for (const slot of GEAR_SLOTS) {
      const instanceID = state.heroes[heroID]?.[slot];
      if (instanceID) result[instanceID] = { heroID, slot };
    }
  return result;
}

/** A protected assignment only grants Grind bonuses while the native slot attests it. */
export function attestedGrindAssignments(
  state: GrindEquipmentState,
  characters: Record<string, { Equipment?: Record<string, { ItemInstanceID?: string | null } | null> | null } | undefined>,
): Record<string, GrindAssignment> {
  return Object.fromEntries(Object.entries(grindAssignments(state)).filter(([instanceID, assignment]) =>
    characters[assignment.heroID]?.Equipment?.[assignment.slot]?.ItemInstanceID === instanceID));
}

export function isGrindEquipped(state: GrindEquipmentState, instanceID: string): boolean {
  return !!grindAssignments(state)[instanceID];
}

export const GRIND_EQUIPMENT_ERRORS: Record<string, string> = {
  HERO_NOT_OWNED: "Hero is locked",
  HERO_LEVEL_TOO_LOW: "Hero level is too low for this item",
  WRONG_CHARACTER: "This item belongs to another hero class",
  INVALID_SLOT: "This item does not fit that slot",
  ITEM_NOT_OWNED: "Item is no longer in Inventory",
  NOT_EQUIPMENT: "This item cannot be equipped",
  ITEM_ALREADY_EQUIPPED_ELSEWHERE: "Item is equipped by another hero",
  INVALID_ITEM_LEVEL_RULE: "Item level requirement is unavailable",
};

type OperationResult = { equipment?: unknown; reason?: string; equipped?: boolean;
  unequipped?: boolean; unequippedInstanceID?: string | null };

export class GrindEquipmentService {
  private readonly client: IDosGamesClient;
  constructor(client: IDosGamesClient) { this.client = client; }

  private async execute(handler: string, args: Record<string, unknown>): Promise<OperationResult> {
    const result = await this.client.cloudCode.execute(handler,
      args as Parameters<typeof this.client.cloudCode.execute>[1]);
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    if (result.data.Error) throw new Error(String(result.data.Error.Message ?? result.data.Error.Error));
    const payload = result.data.FunctionResult;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new Error(`${handler} returned no equipment state`);
    return payload as OperationResult;
  }

  async load(): Promise<GrindEquipmentState> {
    return parseGrindEquipment((await this.execute("getGrindEquipment", {})).equipment);
  }

  private nativeAssignment(heroID: string, slot: GearSlot): string | null {
    const characters = this.client.data.user.state?.Character?.Characters as
      Record<string, { Equipment?: Record<string, { ItemInstanceID?: string } | null> } | undefined> | undefined;
    return characters?.[heroID]?.Equipment?.[slot]?.ItemInstanceID ?? null;
  }

  async equip(heroID: string, slot: GearSlot, itemInstanceID: string): Promise<GrindEquipmentState> {
    // CloudCode cannot read InventoryV2.UnstackableItems from ReadUserData on DEV.
    // Native EquipItems first attests exact ownership; its write never grants Grind bonuses.
    let confirmedID = this.nativeAssignment(heroID, slot);
    if (confirmedID !== itemInstanceID) {
      const native = await this.client.character.equipItems(heroID,
        [{ SlotID: slot, ItemInstanceID: itemInstanceID }]);
      if (!native.ok) throw new Error(String(native.error ?? native.reason ?? "Item is no longer available"));
      confirmedID = native.data.Equipment?.[slot]?.ItemInstanceID ?? null;
    }
    if (!confirmedID) throw new Error("Native equipment confirmation is missing");
    const value = await this.execute("equipGrindItem", { heroID, slot, itemInstanceID: confirmedID });
    if (!value.equipped) throw new Error(GRIND_EQUIPMENT_ERRORS[value.reason ?? ""] ?? value.reason ?? "Equip failed");
    return parseGrindEquipment(value.equipment);
  }

  async unequip(heroID: string, slot: GearSlot): Promise<GrindEquipmentState> {
    const value = await this.execute("unequipGrindItem", { heroID, slot });
    if (!value.unequipped) throw new Error(GRIND_EQUIPMENT_ERRORS[value.reason ?? ""] ?? value.reason ?? "Unequip failed");
    // Native EquippedSlot is the Marketplace server's listing guard. Release it only
    // when it still refers to the same instance that Grind just unequipped.
    if (value.unequippedInstanceID &&
        this.nativeAssignment(heroID, slot) === value.unequippedInstanceID) {
      const native = await this.client.character.unequipItems(heroID, [slot]);
      if (!native.ok) throw new Error(String(native.error ?? native.reason ?? "Native unequip failed"));
    }
    return parseGrindEquipment(value.equipment);
  }

  async equipBest(heroID: string, slots: Partial<Record<GearSlot, string>>): Promise<GrindEquipmentState> {
    const nativeSlots = Object.entries(slots).filter(([slot, ItemInstanceID]) =>
      this.nativeAssignment(heroID, slot as GearSlot) !== ItemInstanceID)
      .map(([SlotID, ItemInstanceID]) => ({ SlotID, ItemInstanceID }));
    const confirmed = { ...slots };
    if (nativeSlots.length) {
      const native = await this.client.character.equipItems(heroID, nativeSlots);
      if (!native.ok) throw new Error(String(native.error ?? native.reason ?? "Items are no longer available"));
      for (const slot of nativeSlots.map((pair) => pair.SlotID as GearSlot)) {
        const instanceID = native.data.Equipment?.[slot]?.ItemInstanceID;
        if (!instanceID) throw new Error(`Native ${slot} confirmation is missing`);
        confirmed[slot] = instanceID;
      }
    }
    const value = await this.execute("equipBestGrindHero", { heroID, slots: confirmed });
    if (!value.equipped) throw new Error(GRIND_EQUIPMENT_ERRORS[value.reason ?? ""] ?? value.reason ?? "Equip best failed");
    return parseGrindEquipment(value.equipment);
  }
}
