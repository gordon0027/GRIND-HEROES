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

The original integration stored equipped assignments in protected CloudCode data rather than the native `EquippedSlot` field. Before creating a listing, the screen checked `isGrindEquipped` and blocked an assigned instance, but direct clients could bypass that screen check. The DEV validation and native-slot synchronization below supersede this initial state.

The sell picker fetches a fresh native inventory snapshot when opened. This matters because a cancelled listing can return the item with a new instance ID; relying on the cached `useUserState()` snapshot produced a stale ID and a failed second listing.

## Historical Main token decision (superseded 2026-10-08)

The player initially chose the existing Solana `Main` crypto token as the Marketplace payment currency instead of GEMS. This plan was superseded by the later PROD GEMS decision below. PROD already defined `CryptoCurrencies.Main` (Solana token `2gzmu2aJtyw35ph7wQhQKTKe9G6rwD91HyjjsEcJidos`) with in-game spending and deposits/withdrawals enabled, while the PROD Marketplace was absent at that time.

The current iDos Marketplace cannot accept `Main` as a price under its server-side policy. The installed and latest published `@idosgames/core` 0.21.2 type for `MarketplacePricePolicy.Allowed[].Kind` admits only `Item`, `VirtualCurrency`, and `EventToken`. A reversible DEV configuration probe that added `{Kind:"CryptoCurrency",CurrencyID:"Main",MinAmount:1}` was rejected by `save_marketplace` with `Error converting value "CryptoCurrency" to type 'IDosGames.EntryResourceKind'`. Readback confirmed that DEV's original GEMS policy remained in place; it was restored and verified. `ResourceBundle` accepting `CryptoCurrency` in its generic SDK type does not override Marketplace's narrower server rule. There is no successful Main listing or purchase test.

To implement the requested Main marketplace, iDos must add `CryptoCurrency` to Marketplace price policy parsing and validation, and support it throughout listing creation, buyer debit, seller credit, commission, cancellation/refund, offer history, and atomic escrow settlement. The contract token's in-game balance should be the unit traded; wallet deposits and withdrawals remain separate blockchain operations. The backend should reject insufficient or unavailable crypto balances before transferring equipment, preserve idempotency and offer locks, and expose the resulting crypto balance updates to the client. Test creation, purchase, cancellation, race handling, and settlement with two funded DEV accounts before enabling PROD. The DEV title currently has no `Main` crypto definition, so a proper token-enabled test environment is also needed.

The local screen builds GEMS price bundles. A future Main-based design would need corresponding amount, balance, label, affordability, and offer/history changes after backend support; `Main_IOU` is an unbacked virtual currency and cannot stand in for Main. No token-priced marketplace build or config has been deployed.

## DEV buy and equipment validation (2026-10-08)

The listing detail now shows the catalog item image, rarity frame, slot, stats, level, quantity and price. Buying requires one explicit name-and-price confirmation, guards repeat clicks while pending, then refreshes the authoritative inventory and market lists. A settled purchase remains reported as successful if the later inventory refresh fails; the player sees a refresh warning. Sold or expired offers close with an unavailable message, while insufficient GEMS leaves the offer open and triggers a balance refresh. Listing and cancellation also refresh inventory so escrowed or returned instance IDs are not inferred from cards.

A real DEV integration run used two newly created guest users. The seller summoned `worn_gloves`, listed its instance `6ac727b5e76ce63b77689d6a` for 1 GEMS, and the buyer opened the offer and purchased it. The offer disappeared; a second buy returned `Offer is already Completed.` The buyer's fresh inventory contained one `worn_gloves` with platform-issued instance `6ac727b7e76ce63b77689d6c`. The seller no longer held the listed instance and GEMS changed 200→201; the buyer changed 300→299. The service's settlement response showed the buyer debit and seller grant. The purchased item cannot be reconstructed with the original seller instance ID; the inventory response is authoritative. A later DEV run also probed duplicate listing and relisting of the sold instance.

Native Character `EquippedSlot` is the Marketplace server's direct listing guard. A direct SDK listing of natively equipped Traveler Boots was rejected with `Instance '…' is equipped — unequip it first.` Normal Grind equip and unequip now synchronize this native state; DEV CloudCode revision 29 also revokes a protected Grind assignment when its native slot no longer attests the same instance, and the client gives bonuses only to attested assignments. A direct native unequip followed by direct Marketplace listing **was accepted** while the old Grind assignment had not yet been read and cleaned. This is a remaining service boundary: Marketplace has no Grind-specific pre-listing hook, so it cannot reject an item that was natively unequipped even if a stale protected assignment still exists. The next authoritative Grind read removes that assignment. Strict cross-service rejection at the listing mutation would require an iDos Marketplace hook or unified server-owned equipment check.

A DEV insufficient-funds buy (1000 GEMS against a 299-GEMS balance) was rejected by the server, and the listing stayed active. A subsequent two-account DEV run used `recurve_bow` and confirmed that a second listing of the escrowed instance and a relisting of the sold instance were rejected. The iDos Marketplace registry describes escrow, mutation locks and optimistic concurrency for listing/purchase races; a true simultaneous multi-buyer stress test was not run.

A separate browser run opened a real DEV `leather_helmet` offer from another guest seller for 1 GEMS. The buyer saw the item details and explicit `Купить Leather Helmet за 1?` confirmation; pending disabled the purchase and Back buttons. After purchase the GEMS balance changed 300→299, the purchased listing vanished from Browse, a success toast appeared, and Inventory showed an additional Leather Helmet. Browser console had no errors or React warnings. None of this changes PROD or resolves the separate `Main` token price-policy blocker.

## Footer and PROD GEMS decision (2026-10-08)

The player superseded the earlier Main-token plan: Marketplace trading in PROD uses GEMS. The footer now has a MARKET button between TEAM and MORE; it opens the registered Marketplace screen directly and uses the same equipment art and frame system. MORE no longer duplicates the Marketplace entry. If the title has no enabled Marketplace section, the footer shows an unavailable message instead of a broken screen. The PROD rollout requires GEMS tradability, the 50 Grind gear definitions to be tradable, the DEV-tested listing policy, and the server CloudCode equipment handlers; preserve PROD's existing Main token and party-slot prices while applying it.

PROD rollout completed as client build v34 (`bld7d36c03e55db4d9f8f23bfbf613d6687`, 113 files) at `https://98jrcakg.idos.games/`. PROD `GEMS.Permissions.IsTradable` is enabled; the 50 `grind-gear` items are tradable; Marketplace uses the DEV-verified GEMS listing policy (24/72/168 hours, zero commission, auctions/orders/direct trades disabled). PROD CloudCode revision 3 uses the DEV-verified equipment and stage handlers while retaining PROD party-slot prices of 50,000 and 250,000 GOLD. The PROD Main crypto definition and `Main_IOU` remain unchanged. A fresh PROD guest opened the live root and Marketplace through the footer; the empty market rendered with no listings. A quick root reload logged one CloudCode rate-limit error, `Too soon. Try again in 3s`; the screen recovered. No live PROD sale or purchase was performed during rollout; the two-account trade test remains DEV-only.
