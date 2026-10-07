# Grind Heroes marketplace

The iDos Marketplace system was available in the registry but was not installed in this checkout. Its existing SDK service handles listings, escrow, purchases, cancellations, claims and history. The project adds a Grind Heroes screen around that service; it does not implement a second trading backend.

The player chose **GEMS and equipment** for trading. In the DEV title, Marketplace and GEMS trading are enabled and the 50 `grind-gear` equipment definitions are tradable. Listings use GEMS, with 24, 72 or 168 hour durations and no commission. Auctions, buy orders and direct trades remain disabled. PROD configuration was not changed.

Marketplace equipment uses the same icon URL and rarity frame component as the Inventory UI. Item names, slots, rarities and stats come from the title catalog; listing levels come from offer instances. The grouped Marketplace endpoint has counts by item, but no per-listing prices or levels. The browse screen therefore offers name search and slot/rarity filters, with sorting by name, rarity or offer count. Price and level appear after opening an item's offers, where existing cursor pagination and cheapest-first listing order are retained.

Grind Heroes stores equipped assignments in protected CloudCode data rather than the native `EquippedSlot` field. Before creating a listing, the screen checks `isGrindEquipped` and blocks an assigned instance. The built-in Marketplace service does not apply that Grind-specific rule server-side; other clients that call it directly can bypass the screen check. Grind's equipment read cleans up references to no-longer-owned instances so sold gear stops contributing bonuses. Revisit this boundary if the platform adds a server-side pre-listing hook.

The sell picker fetches a fresh native inventory snapshot when opened. This matters because a cancelled listing can return the item with a new instance ID; relying on the cached `useUserState()` snapshot produced a stale ID and a failed second listing.
