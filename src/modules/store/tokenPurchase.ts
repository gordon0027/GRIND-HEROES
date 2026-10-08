import {
  OFFER_NOT_IN_ROTATION,
  type GetStorefrontResponse,
  type IDosGamesClient,
  type StorefrontOfferView,
} from "@idosgames/core";

/** Stable addresses of the four GH offers. Prices and rewards come from the resolved Storefront. */
export const tokenStoreOffers = {
  gems_small: { offerID: "gh_gems_small", sectionID: "gh_gems", slotID: "slot_gh_gems_small", rewardType: "VirtualCurrency", rewardID: "GEMS" },
  gems_medium: { offerID: "gh_gems_medium", sectionID: "gh_gems", slotID: "slot_gh_gems_medium", rewardType: "VirtualCurrency", rewardID: "GEMS" },
  gems_large: { offerID: "gh_gems_large", sectionID: "gh_gems", slotID: "slot_gh_gems_large", rewardType: "VirtualCurrency", rewardID: "GEMS" },
  premium_chest_v1: { offerID: "gh_premium_chest_v1", sectionID: "gh_premium_chests", slotID: "slot_gh_premium_chest_v1", rewardType: "Item", rewardID: "premium_chest_v1" },
} as const;

export type TokenShopProductID = keyof typeof tokenStoreOffers;

export interface ResolvedTokenOffer {
  productID: TokenShopProductID;
  offerID: string;
  storeID: string;
  sectionID: string;
  slotID: string;
  optionID: string;
  ghPrice: number;
  rewardAmount: number;
  soldOut: boolean;
  availableAtUtc: string | null;
}

export function isTokenShopProductID(id: string): id is TokenShopProductID {
  return Object.hasOwn(tokenStoreOffers, id);
}

/** Reject incomplete or unexpected offers instead of showing a misleading price or reward. */
export function resolveTokenShopOffer(front: GetStorefrontResponse | null, productID: string): ResolvedTokenOffer | null {
  if (!front || !isTokenShopProductID(productID)) return null;
  const address = tokenStoreOffers[productID];
  const store = front.Stores?.find((item) => item.StoreID === "shop");
  const section = store?.Sections?.find((item) => item.SectionID === address.sectionID);
  const slot = section?.Slots?.find((item) => item.SlotID === address.slotID);
  const offer: StorefrontOfferView | null | undefined = slot?.Offer;
  if (!offer || offer.OfferID !== address.offerID) return null;
  const option = offer.PriceOptions?.find((item) => item.OptionID === "gh");
  const cost = option?.Cost;
  const costEntries = cost?.Standard?.Entries ?? [];
  const reward = offer.Rewards;
  const rewardEntries = reward?.Standard?.Entries ?? [];
  if (!option || option.IsFree || option.IsStorePaid || option.IsAdPaid ||
    costEntries.length !== 1 || (cost?.Standard?.EventTokens?.length ?? 0) !== 0 ||
    (cost?.PremiumDiscounts?.length ?? 0) !== 0 || rewardEntries.length !== 1 ||
    (reward?.Standard?.EventTokens?.length ?? 0) !== 0 ||
    (reward?.PremiumTiers?.length ?? 0) !== 0) return null;
  const price = costEntries[0];
  const grant = rewardEntries[0];
  if (price?.Type !== "CryptoCurrency" || price.CurrencyID !== "Main" ||
    !Number.isSafeInteger(price.Amount) || Number(price.Amount) <= 0 ||
    grant?.Type !== address.rewardType || !Number.isSafeInteger(grant.Amount) ||
    Number(grant.Amount) <= 0) return null;
  if (address.rewardType === "VirtualCurrency" ? grant.CurrencyID !== address.rewardID :
    grant.CatalogID !== "Item" || grant.ItemID !== address.rewardID) return null;
  return {
    productID, offerID: address.offerID, storeID: store!.StoreID,
    sectionID: section!.SectionID, slotID: slot!.SlotID, optionID: option.OptionID,
    ghPrice: Number(price.Amount), rewardAmount: Number(grant.Amount),
    soldOut: offer.State?.SoldOut === true,
    availableAtUtc: offer.State?.AvailableAtUtc ?? null,
  };
}

export type TokenPurchaseError = "insufficient" | "unavailable" | "limit" | "disabled" | "connection" | "server";

export function tokenPurchaseMessage(error: TokenPurchaseError): string {
  switch (error) {
    case "insufficient": return "Not enough GH in your game balance. Deposit GH from your wallet first.";
    case "unavailable": return "This offer changed or is unavailable. Refresh the Shop and try again.";
    case "limit": return "The purchase limit for this offer has been reached.";
    case "disabled": return "This offer is not available.";
    case "connection": return "Connection failed. Check your balance before trying again.";
    default: return "Purchase could not be completed. Please try again later.";
  }
}

export function showDepositOnPurchaseError(error: TokenPurchaseError): boolean {
  return error === "insufficient";
}

export function classifyTokenPurchaseError(reason: string | undefined, error: string | undefined): TokenPurchaseError {
  const message = `${reason ?? ""} ${error ?? ""}`;
  if (/not enough|insufficient|balance.*need|cannot afford|not_enough/i.test(message)) return "insufficient";
  if (/OFFER_NOT_IN_ROTATION|not in rotation|outside.*window|not available|expired/i.test(message) || error === OFFER_NOT_IN_ROTATION) return "unavailable";
  if (/limit|cap|sold out|cooldown|already purchased/i.test(message)) return "limit";
  if (/unknown|invalid|disabled|not found|does not exist/i.test(message)) return "disabled";
  if (/connection|throttled|timeout|network/i.test(message)) return "connection";
  return "server";
}

export type TokenPurchaseOutcome =
  | { ok: true; inventoryFresh: boolean; storefrontFresh: boolean }
  | { ok: false; error: TokenPurchaseError; detail?: string };

export async function purchaseTokenShopProduct(
  client: IDosGamesClient, productID: string, resolved: ResolvedTokenOffer | null,
): Promise<TokenPurchaseOutcome> {
  if (!isTokenShopProductID(productID)) return { ok: false, error: "disabled" };
  const address = tokenStoreOffers[productID];
  if (!resolved || resolved.productID !== productID || resolved.offerID !== address.offerID ||
    resolved.storeID !== "shop" || resolved.sectionID !== address.sectionID ||
    resolved.slotID !== address.slotID || resolved.optionID !== "gh")
    return { ok: false, error: "unavailable" };
  if (resolved.soldOut || resolved.availableAtUtc) return { ok: false, error: "limit" };
  const result = await client.store.purchase(address.offerID, 1, {
    selectedOptionID: resolved.optionID,
    slot: { storeID: "shop", sectionID: address.sectionID, slotID: address.slotID },
  });
  if (!result.ok) return {
    ok: false, error: classifyTokenPurchaseError(result.reason, result.error),
    detail: result.error,
  };
  // The SDK applies the confirmed operation. Re-fetch balances, inventory and counters.
  // Refresh failure never reclassifies a completed paid purchase as a failure.
  const [inventory, storefront] = await Promise.allSettled([
    client.user.getUserInventory(), client.store.getStorefront(),
  ]);
  return {
    ok: true,
    inventoryFresh: inventory.status === "fulfilled" && inventory.value.ok,
    storefrontFresh: storefront.status === "fulfilled" && storefront.value.ok,
  };
}

/** A synchronous gate: two clicks in one React render can start only one SDK purchase. */
export function createTokenPurchaseGate() {
  let pending = false;
  return {
    isPending: () => pending,
    async run<T>(action: () => Promise<T>): Promise<T | null> {
      if (pending) return null;
      pending = true;
      try { return await action(); }
      finally { pending = false; }
    },
  };
}

export function formatWholeGh(amount: string | null | undefined): string {
  if (typeof amount !== "string" || !/^\d+(?:\.0+)?$/.test(amount)) return "—";
  return BigInt(amount.split(".")[0]!).toLocaleString("en-US");
}
