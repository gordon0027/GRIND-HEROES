import type { SlotIndex } from "./stageRun";
import { isPlayableHeroID } from "./progression.ts";

const FORMATION_SIZE = 3;

export const FORMATION_KEY = "grind_formation_v2";
export const PARTY_CAPACITY_KEY = "grind_party_capacity_v2";

export interface Formation {
  version: 2;
  slots: [string | null, string | null, string | null];
}

export function partyCapacity(raw: string | null | undefined): 1 | 2 | 3 {
  const value = Number(raw);
  return value === 2 || value === 3 ? value : 1;
}

export function defaultFormation(owned: ReadonlySet<string>): Formation {
  return { version: 2, slots: [owned.has("Knight") ? "Knight" : ([...owned].find(isPlayableHeroID) ?? null), null, null] };
}

export function validateFormation(value: unknown, owned: ReadonlySet<string>, capacity: number): value is Formation {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Formation>;
  if (record.version !== 2 || !Array.isArray(record.slots) || record.slots.length !== FORMATION_SIZE) return false;
  const assigned = record.slots.filter((id): id is string => typeof id === "string" && id.length > 0);
  return record.slots.every((id, index) =>
    (id === null || (typeof id === "string" && isPlayableHeroID(id) && owned.has(id))) &&
    (index < capacity || id === null)) &&
    new Set(assigned).size === assigned.length && assigned.length > 0;
}

export function restoreFormation(raw: string | null | undefined, owned: ReadonlySet<string>, capacity: number): Formation {
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (validateFormation(parsed, owned, capacity)) return parsed;
      if (parsed && typeof parsed === "object" && (parsed as Formation).version === 2 &&
          Array.isArray((parsed as Formation).slots) &&
          (parsed as Formation).slots.length === FORMATION_SIZE) {
        const seen = new Set<string>();
        const slots = (parsed as Formation).slots.map((id, index) => {
          if (index >= capacity || typeof id !== "string" || !isPlayableHeroID(id) ||
              !owned.has(id) || seen.has(id)) return null;
          seen.add(id);
          return id;
        }) as Formation["slots"];
        if (!slots[0] && owned.has("Knight") && !seen.has("Knight")) slots[0] = "Knight";
        const sanitized: Formation = { version: 2, slots };
        if (validateFormation(sanitized, owned, capacity)) return sanitized;
      }
    } catch { /* An invalid saved value cannot become a deployable party. */ }
  }
  return defaultFormation(owned);
}

export function assignFormation(
  formation: Formation, slot: SlotIndex, heroID: string | null,
  owned: ReadonlySet<string>, capacity: number,
): Formation | null {
  if (slot > capacity || (heroID !== null && (!isPlayableHeroID(heroID) || !owned.has(heroID)))) return null;
  const slots = [...formation.slots] as Formation["slots"];
  if (heroID !== null && slots.some((id, index) => id === heroID && index !== slot - 1)) return null;
  slots[slot - 1] = heroID;
  const next: Formation = { version: 2, slots };
  return validateFormation(next, owned, capacity) ? next : null;
}
