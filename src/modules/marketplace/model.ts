// Pure helpers of the marketplace screen (Unity Alikhan/Marketplace) — covered by model.test.ts.
// The server holds the escrow and settles every trade; these only decide what the screen shows.

import type {
  MarketplaceDefinitions,
  MarketplaceOfferView,
} from "@idosgames/core";
import {
  bundleLines,
  type ItemDefinitionView,
  type ResourceLine,
} from "@idosgames/react/ui";

/** The price of a listing, as lines. */
export function offerPrice(offer: MarketplaceOfferView): ResourceLine[] {
  return bundleLines(offer.Price as never);
}

/** The single currency of a price (listings are priced in one currency in this screen). */
export function priceAmount(offer: MarketplaceOfferView): number {
  return offerPrice(offer)[0]?.amount ?? 0;
}

/** Offers for one item, cheapest listing first, then auctions ending soonest. */
export function sortOffers(
  offers: MarketplaceOfferView[],
): MarketplaceOfferView[] {
  const listings = offers
    .filter((o) => o.OfferType === "Listing")
    .sort((a, b) => priceAmount(a) - priceAmount(b));
  const auctions = offers
    .filter((o) => o.OfferType === "Auction")
    .sort((a, b) =>
      String(a.ExpiresAt ?? "").localeCompare(String(b.ExpiresAt ?? "")),
    );
  return [
    ...listings,
    ...auctions,
    ...offers.filter(
      (o) => o.OfferType !== "Listing" && o.OfferType !== "Auction",
    ),
  ];
}

/** The lowest bid the server accepts next: the current bid plus the configured step (or the start). */
export function minNextBid(
  offer: MarketplaceOfferView,
  defs: MarketplaceDefinitions | null | undefined,
): number {
  const a = offer.Auction;
  const current = Number(a?.CurrentBid ?? 0);
  if (!a || current <= 0 || !a.CurrentBidderID)
    return Math.max(1, Number(a?.StartingBid ?? 1));
  // The engine's rule: step = max(ceil(current × fraction), MinBidStepAbsolute); 0.05 = 5%.
  const fraction = Number(defs?.Auctions?.MinBidStepPercent ?? 0.05);
  const abs = Number(defs?.Auctions?.MinBidStepAbsolute ?? 0);
  const step = Math.max(1, abs, Math.ceil(current * fraction));
  return current + step;
}

/** Durations the title allows for a listing (hours), with a sane fallback. */
export function listingDurations(
  defs: MarketplaceDefinitions | null | undefined,
): number[] {
  const allowed = (defs?.Listings?.AllowedDurationsHours ?? []).filter(
    (h) => h > 0,
  );
  return allowed.length > 0 ? [...allowed].sort((a, b) => a - b) : [24, 72];
}

/** Durations for an auction within the title's bounds. */
export function auctionDurations(
  defs: MarketplaceDefinitions | null | undefined,
): number[] {
  const min = Math.max(1, Number(defs?.Auctions?.MinDurationHours ?? 1));
  const max = Math.max(min, Number(defs?.Auctions?.MaxDurationHours ?? 72));
  return [...new Set([min, Math.min(max, 24), max])]
    .filter((h) => h >= min && h <= max)
    .sort((a, b) => a - b);
}

/** Commission the seller pays, in percent for display. The config holds a FRACTION (0.05 = 5%). */
export function commissionPercent(
  defs: MarketplaceDefinitions | null | undefined,
): number {
  return Math.round(Number(defs?.Commission?.Percent ?? 0.05) * 1000) / 10;
}

export interface SellableItem {
  itemID: string;
  catalogID: string;
  amount: number;
  /** Unstackable: instance ids the player can put up (not equipped). */
  instances: string[];
}

/** Owned items the player may sell: tradable definitions, instances that are not worn. */
export function sellableItems(
  inventory:
    | {
        Items?: Record<
          string,
          { StackableAmount?: number; TotalAmount?: number } | null
        > | null;
        UnstackableItems?: Record<
          string,
          { ItemID?: string; EquippedSlot?: unknown } | null
        > | null;
      }
    | null
    | undefined,
  items: Map<
    string,
    ItemDefinitionView & { CatalogID?: string; IsTradable?: boolean | null }
  >,
): SellableItem[] {
  const out = new Map<string, SellableItem>();
  for (const [id, t] of Object.entries(inventory?.Items ?? {})) {
    const def = items.get(id);
    if (!def || def.IsTradable !== true || def.IsStackable === false) continue;
    const amount = Number(t?.StackableAmount ?? t?.TotalAmount ?? 0);
    if (amount > 0)
      out.set(id, {
        itemID: id,
        catalogID: def.CatalogID ?? "Item",
        amount,
        instances: [],
      });
  }
  for (const [instanceID, inst] of Object.entries(
    inventory?.UnstackableItems ?? {},
  )) {
    if (!inst?.ItemID || inst.EquippedSlot) continue;
    const def = items.get(inst.ItemID);
    if (!def || def.IsTradable !== true) continue;
    const entry = out.get(inst.ItemID) ?? {
      itemID: inst.ItemID,
      catalogID: def.CatalogID ?? "Item",
      amount: 0,
      instances: [],
    };
    entry.instances.push(instanceID);
    entry.amount = entry.instances.length;
    out.set(inst.ItemID, entry);
  }
  return [...out.values()].sort((a, b) => a.itemID.localeCompare(b.itemID));
}

/** Listings and auctions of a market group. The server fills CountsByType (the *Count fields are
 *  optional mirrors of it), so both are read. */
export function groupCounts(g: {
  CountsByType?: Partial<Record<string, number>> | null;
  ListingCount?: number | null;
  AuctionCount?: number | null;
}): { listings: number; auctions: number } {
  return {
    listings: Number(g.ListingCount ?? g.CountsByType?.Listing ?? 0),
    auctions: Number(g.AuctionCount ?? g.CountsByType?.Auction ?? 0),
  };
}

/** Currencies a lot can be priced in: the engine refuses one not tradable between players. */
export function tradableCurrencies(
  currencies: Record<
    string,
    { Permissions?: { IsTradable?: boolean | null } | null } | null | undefined
  >,
): string[] {
  return Object.entries(currencies)
    .filter(([, c]) => c?.Permissions?.IsTradable === true)
    .map(([id]) => id);
}

/** A price bundle of one currency. */
export function priceBundle(
  currencyID: string,
  amount: number,
): {
  Entries: Array<{
    Type: "VirtualCurrency";
    CurrencyID: string;
    Amount: number;
  }>;
} {
  return {
    Entries: [
      {
        Type: "VirtualCurrency",
        CurrencyID: currencyID,
        Amount: Math.max(1, Math.floor(amount)),
      },
    ],
  };
}

/** Badge of the marketplace: things to claim + incoming trades waiting for an answer. */
export function marketplaceBadge(
  state:
    | { Claimables?: unknown[] | null; IncomingTrades?: unknown[] | null }
    | null
    | undefined,
): number {
  return (
    (state?.Claimables?.length ?? 0) + (state?.IncomingTrades?.length ?? 0)
  );
}

/** Whether the title's marketplace is set up and not switched off — else the lobby hides the tab. */
export function hasTitleData(
  section: { Enabled?: boolean | null } | null | undefined,
): boolean {
  return section != null && section.Enabled !== false;
}
