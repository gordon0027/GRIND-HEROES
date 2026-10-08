# Grind Heroes marketplace

## Global activity statistics feasibility (2026-10-08)

The current iDos Marketplace stores completed sales in an internal append-only
`MarketplaceTradeLogDocument`, deduplicated by terminal status and offer ID.
The SDK's `getHistory()` reads only the signed-in player's projection of that
log. `getGroupedOffers()` covers active offers, and PROD Marketplace, Analytics,
Purchase, TitleCustomData and DataCollections configuration expose no global
completed-sale aggregate. PROD CloudCode has no Marketplace log read, sale
event hook, or Marketplace settlement operation in its documented `server.*`
surface. Browser-reported purchases would be bypassable and client-forged, so
CloudCode counters incremented from them would not be authoritative. No
statistics counters or historical backfill were published. A platform-side
aggregate over immutable completed Marketplace trade logs, or a trusted
post-settlement hook, is required before the requested global panel can show
Items Sold (sold quantity), GEMS Volume (buyer GEMS paid), and Transactions
(completed purchase operations). Current PROD values are unknown, not zero.

The iDos Marketplace system was available in the registry but was not installed in this checkout. Its existing SDK service handles listings, escrow, purchases, cancellations, claims and history. The project adds a Grind Heroes screen around that service; it does not implement a second trading backend.

The player chose **GEMS and equipment** for trading. In the DEV title, Marketplace and GEMS trading are enabled and the 50 `grind-gear` equipment definitions are tradable. Listings use GEMS, with 24, 72 or 168 hour durations and no commission. Auctions, buy orders and direct trades remain disabled. PROD configuration was not changed.

Marketplace equipment uses the same icon URL and rarity frame component as the Inventory UI. Item names, slots, rarities and stats come from the title catalog; listing levels come from offer instances. The grouped Marketplace endpoint has counts by item, but no per-listing prices or levels. The browse screen therefore offers name search and slot/rarity filters, with sorting by name, rarity or offer count. Price and level appear after opening an item's offers, where existing cursor pagination and cheapest-first listing order are retained.

Grind Heroes stores equipped assignments in protected CloudCode data rather than the native `EquippedSlot` field. Before creating a listing, the screen checks `isGrindEquipped` and blocks an assigned instance. The built-in Marketplace service does not apply that Grind-specific rule server-side; other clients that call it directly can bypass the screen check. Grind's equipment read cleans up references to no-longer-owned instances so sold gear stops contributing bonuses. Revisit this boundary if the platform adds a server-side pre-listing hook.

The sell picker fetches a fresh native inventory snapshot when opened. This matters because a cancelled listing can return the item with a new instance ID; relying on the cached `useUserState()` snapshot produced a stale ID and a failed second listing.

## Main token decision (2026-10-08)

The player chose the existing Solana `Main` crypto token as the Marketplace payment currency instead of GEMS. Do not publish the GEMS Marketplace configuration to PROD as the target implementation. PROD already defines `CryptoCurrencies.Main` (Solana token `2gzmu2aJtyw35ph7wQhQKTKe9G6rwD91HyjjsEcJidos`) with in-game spending and deposits/withdrawals enabled, but the PROD Marketplace itself is still absent.

The current iDos Marketplace cannot accept `Main` as a price under its server-side policy. The installed and latest published `@idosgames/core` 0.21.2 type for `MarketplacePricePolicy.Allowed[].Kind` admits only `Item`, `VirtualCurrency`, and `EventToken`. A reversible DEV configuration probe that added `{Kind:"CryptoCurrency",CurrencyID:"Main",MinAmount:1}` was rejected by `save_marketplace` with `Error converting value "CryptoCurrency" to type 'IDosGames.EntryResourceKind'`. Readback confirmed that DEV's original GEMS policy remained in place; it was restored and verified. `ResourceBundle` accepting `CryptoCurrency` in its generic SDK type does not override Marketplace's narrower server rule. There is no successful Main listing or purchase test.

To implement the requested Main marketplace, iDos must add `CryptoCurrency` to Marketplace price policy parsing and validation, and support it throughout listing creation, buyer debit, seller credit, commission, cancellation/refund, offer history, and atomic escrow settlement. The contract token's in-game balance should be the unit traded; wallet deposits and withdrawals remain separate blockchain operations. The backend should reject insufficient or unavailable crypto balances before transferring equipment, preserve idempotency and offer locks, and expose the resulting crypto balance updates to the client. Test creation, purchase, cancellation, race handling, and settlement with two funded DEV accounts before enabling PROD. The DEV title currently has no `Main` crypto definition, so a proper token-enabled test environment is also needed.

The local screen still builds GEMS price bundles. Change its amount, balance, label, sorting, affordability, and offer/history rendering to `Main` only after the backend accepts crypto prices. Do not label `Main_IOU` or GEMS as Main: `Main_IOU` is configured as an unbacked virtual currency and the currency service does not support virtual-to-crypto conversion. No token-priced marketplace build or config has been deployed.
