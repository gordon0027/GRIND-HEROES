// Pure helpers of the shop screen — covered by model.test.ts.

import type {
  GetStorefrontResponse,
  StorefrontOfferView,
  StorefrontSectionView,
  StorefrontSlotView,
} from "@idosgames/core";
import { costLines } from "@idosgames/react/ui";

export function sortedSections(
  store: { Sections?: StorefrontSectionView[] | null } | null | undefined,
): StorefrontSectionView[] {
  return (store?.Sections ?? [])
    .slice()
    .sort((a, b) => a.SortOrder - b.SortOrder);
}

export function slotsOf(section: StorefrontSectionView): StorefrontSlotView[] {
  return (section.Slots ?? [])
    .slice()
    .sort((a, b) => a.SortOrder - b.SortOrder);
}

/** When the first card of a section refreshes — the section's countdown. */
export function earliestRefresh(section: StorefrontSectionView): string | null {
  const times = slotsOf(section)
    .map((s) => s.RefreshesAtUtc)
    .filter((x): x is string => typeof x === "string")
    .sort();
  return times[0] ?? null;
}

export function isFree(offer: StorefrontOfferView): boolean {
  const option = offer.PriceOptions?.[0];
  return option?.IsFree === true || costLines(option?.Cost).length === 0;
}

/** Offers the player can take right now (not sold out, not waiting for their window). */
export function isAvailable(offer: StorefrontOfferView): boolean {
  return offer.State?.SoldOut !== true && !offer.State?.AvailableAtUtc;
}

/** The badge of the shop: free offers waiting to be taken (the daily gift). */
export function freeOffersWaiting(
  front: GetStorefrontResponse | null | undefined,
): number {
  let n = 0;
  for (const store of front?.Stores ?? [])
    for (const section of store.Sections ?? [])
      for (const slot of section.Slots ?? [])
        if (slot.Offer && isFree(slot.Offer) && isAvailable(slot.Offer)) n++;
  return n;
}

/** Stores by their order; the first is the default tab. */
export function sortedStores(
  front: GetStorefrontResponse | null | undefined,
): NonNullable<GetStorefrontResponse["Stores"]> {
  return (front?.Stores ?? [])
    .slice()
    .sort((a, b) => a.SortOrder - b.SortOrder);
}

/** Whether the storefront has any offer — until it does, the lobby hides the Shop tab. */
export function hasOffers(
  front: GetStorefrontResponse | null | undefined,
): boolean {
  return (front?.Stores ?? []).some((store) =>
    (store.Sections ?? []).some((section) =>
      (section.Slots ?? []).some((slot) => slot.Offer != null),
    ),
  );
}
