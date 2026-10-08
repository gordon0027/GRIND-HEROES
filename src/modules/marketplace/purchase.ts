import type { IDosGamesClient } from "@idosgames/core";

export type PurchaseOutcome =
  | { kind: "purchased"; inventorySynced: boolean }
  | { kind: "unavailable" }
  | { kind: "insufficient" }
  | { kind: "failed"; error: string };

/** The Marketplace owns settlement; a fresh inventory read supplies the purchased instance ID. */
export async function purchaseListing(
  client: IDosGamesClient,
  offerID: string,
): Promise<PurchaseOutcome> {
  const result = await client.marketplace.buy(offerID);
  if (result.ok) {
    try {
      const inventory = await client.user.getUserInventory();
      return { kind: "purchased", inventorySynced: inventory.ok };
    } catch {
      return { kind: "purchased", inventorySynced: false };
    }
  }

  const error = String(result.error ?? result.reason ?? "Purchase failed");
  if (result.reason === "server" && /insufficient balance/i.test(error))
    return { kind: "insufficient" };
  if (result.reason === "server" &&
      (/^Offer is already (?:Completed|Cancelled|Expired)\./i.test(error) ||
        /^Offer not found\./i.test(error)))
    return { kind: "unavailable" };

  // The backend may phrase a stale-offer error differently. Its current offer
  // status, when readable, is a stronger signal than guessing from text.
  if (result.reason === "server") {
    const current = await client.marketplace.getOffer(offerID);
    if (current.ok && current.data.Offer?.Status !== "Active")
      return { kind: "unavailable" };
    if (!current.ok && current.reason === "server" &&
        /not found/i.test(String(current.error ?? "")))
      return { kind: "unavailable" };
  }
  return { kind: "failed", error };
}
