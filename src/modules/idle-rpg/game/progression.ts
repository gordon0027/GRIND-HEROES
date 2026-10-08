import type { CharacterDefView } from "./heroStats";

export const GOLD_CURRENCY_ID = "GOLD";
export const PLAYABLE_HERO_IDS = ["Knight", "Archer", "Mage"] as const;
export const RECRUITABLE_HERO_IDS = ["Archer", "Mage"] as const;

export function isPlayableHeroID(id: string): boolean {
  return (PLAYABLE_HERO_IDS as readonly string[]).includes(id);
}

type RecruitDefinition = CharacterDefView & {
  Unlock?: { PriceOptions?: Record<string, { Cost?: { Standard?: { Entries?: Array<{
    Type?: string; CurrencyID?: string; Amount?: number;
  } | null> } } } | null> };
};

/** Display the server-configured Character price; never invent a client purchase price. */
export function heroRecruitCost(definition: CharacterDefView): number | null {
  const options = (definition as RecruitDefinition).Unlock?.PriceOptions;
  const entries = Object.values(options ?? {}).find(Boolean)?.Cost?.Standard?.Entries ?? [];
  if (entries.length !== 1 || entries[0]?.Type !== "VirtualCurrency" ||
      entries[0].CurrencyID !== GOLD_CURRENCY_ID) return null;
  const amount = Number(entries[0].Amount);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
