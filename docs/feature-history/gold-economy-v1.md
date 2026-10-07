# GOLD economy rebalance V1 — DEV and PROD

Scope: hero recruitment, party capacity, and `idle_gold` on Title `98JRCAKG` in DEV and PROD. Stage GOLD, XP, loot, chests, combat, and other currencies are unchanged.

## Audited authority and target

| Purchase | Audited DEV price | Target price (×10) | Authority |
| --- | ---: | ---: | --- |
| Archer | 2,500 | 25,000 | Character `Unlock.PriceOptions.default` |
| Mage | 10,000 | 100,000 | Character `Unlock.PriceOptions.default` |
| Party slot 2 | 5,000 | 50,000 | CloudCode `GH_PARTY_SLOT_COSTS` |
| Party slot 3 | 25,000 | 250,000 | CloudCode `GH_PARTY_SLOT_COSTS` |

The UI reads Character definitions for recruitment and calls `getPartySlotPrices` for capacity. Existing ownership and purchased capacity require no migration. On 2026-10-07, Archer and Mage prices were saved to DEV and independently read back as 25,000 and 100,000. The local CloudCode source and tests have the new slot prices, but DEV CloudCode is still revision 28 with the old 5,000 and 25,000 prices. The user deferred that upload. A one-key CloudCode JSON draft is prepared in `.tmp/gold-economy-dev-cloudcode.json`; publish only to DEV after reviewing it, then read back the revision and live `getPartySlotPrices` result.

On 2026-10-07 the user switched the release target to PROD. Archer and Mage prices were saved to PROD and independently read back as 25,000 and 100,000. CloudCode was updated from PROD revision 1 to revision 2 using selective, one-key import from `.tmp/gold-economy-prod-cloudcode.json`. The source differs from the former PROD source only at `GH_PARTY_SLOT_COSTS`, now 50,000 and 250,000. The save review showed exactly one changed top-level section, CloudCode. A fresh PROD export independently confirmed revision 2, both new slot prices, hero prices, idle settings, and that no other top-level section changed from the export immediately before the CloudCode save. The original PROD configuration backup is `C:\Users\BG\Downloads\98JRCAKG.title-public-configuration.2026-10-07T17-13-35-973Z.json`. A live `getPartySlotPrices` invocation and purchase boundary check were not available through the current read-only MCP surface.

The audited DEV `idle_gold` Reward has `BaseRatePerSecond = 2`, `PowerCoefficient = 0`, `MaxAccumulationSeconds = 28800`, `MinClaimSeconds = 10`, and one GOLD per unit. The chosen target is **0.30 GOLD/s**, with PowerCoefficient 0 and the same eight-hour cap. The fixed rate keeps native Character Power out of GOLD accrual.

On 2026-10-07 the DEV Reward was saved and independently read back with `BaseRatePerSecond = 0.3`, `PowerCoefficient = 0`, and `MaxAccumulationSeconds = 28800`. The DEV preview showed `+ 0.3 /s`. Claim settlement was not separately exercised. Local `npm run typecheck`, `npm run build`, and `npm test` passed, including slot price boundary and duplicate-purchase tests; live slot purchase boundaries remain untested.

The same Reward changes were saved to PROD on 2026-10-07 and independently read back: `BaseRatePerSecond = 0.3`, `PowerCoefficient = 0`, `MaxAccumulationSeconds = 28800`. PROD claim settlement has not been exercised.

| Rate | GOLD/hour | Eight-hour claim |
| ---: | ---: | ---: |
| 0.25/s | 900 | 7,200 |
| **0.30/s** | **1,080** | **8,640** |
| 0.40/s | 1,440 | 11,520 |
| Old 2/s | 7,200 | 57,600 |

## Active income audit

The current stage GOLD values and measured clear times give these repeat-farming estimates. Travel, menus, and failures make real rates lower.

| Stage | GOLD/clear | Clear time | GOLD/hour |
| --- | ---: | ---: | ---: |
| 1-1 | 30 | 54 s | 2,000 |
| 1-10 | 102 | 64 s | 5,738 |
| 2-10 | 352 | 81 s | 15,644 |
| 3-10 | 642 | 83 s | 27,846 |

The target idle income is 19% of repeat 1-10 farming. Even 1-1 active farming exceeds it, and later Acts yield more. One full AFK claim covers 35% of Archer, 17% of slot 2, 9% of Mage, or 3% of slot 3.

Simple time estimates from zero GOLD, excluding one-time stage rewards and the eight-hour claim cap:

| Milestone | Idle at 1,080/h | Representative active farming |
| --- | ---: | ---: |
| Archer 25,000 | 23.1 h of accrued AFK | 12.5 h at 1-1 |
| Slot 2 50,000 | 46.3 h of accrued AFK | 8.7 h at 1-10 |
| Mage 100,000 | 92.6 h of accrued AFK | 17.4 h at 1-10 |
| Slot 3 250,000 | 231.5 h of accrued AFK | 16.0 h at 2-10 |

AFK hours assume periodic claims because accrual stops after eight hours. These are price ÷ income illustrations, not predictions of when a player reaches a stage.
