# Economy and GH accounting

## Live capabilities

| Resource | Use |
| --- | --- |
| GOLD | Hero Levels, hero recruitment, party slots and ordinary supplies/pets. Earned from stages and idle accrual. |
| GEMS | Equipment Marketplace and eligible Store supplies/pets. |
| GH / Main | Solana token balance in the iDos platform wallet; supported Store utility for GEMS and Premium Chests. |
| Chests | Server-rolled equipment; earned stage chests are separate from purchased Premium Chests. |

The account, native character upgrades, ownership, inventory, Marketplace escrow
and settlement live in iDos services. Battle simulation and visuals run locally;
CloudCode validates stage eligibility, run identity, server duration, participation
and duplicate completion before awarding resources. The server does not replay
the entire combat simulation. Equipment is not represented as Solana NFTs.

Jury Edition does not change currency prices, resource amounts, chest pools,
tokenomics, supply, staking, contracts or live Title configuration. GH Store
payments are separate from reward accounting and are not tested with real GH in
this release. The base wallet continues to handle supported deposits/withdrawals.

## Ordinary progression

Stage GOLD is 100–325 in Act 1, 420–780 in Act 2 and 900–1,440 in Act 3.
AFK accrual is 0.4 GOLD/second (24/minute), capped at eight hours (11,520 GOLD).
The 500 starter GOLD covers Hero Level 2. See [Progression](PROGRESSION.md) for
the full ladder and measured farming estimate.

The audited DEV recruitment prices are Archer 8,000 and Mage 30,000 GOLD; party
slots cost 3,000 and 12,000 GOLD and are bought separately. These investments are
longer-term idle-RPG goals. Native config is authoritative if prices change.
The demo does not promise a full three-hero party in two minutes or grant shortcuts.

## GH Earnings

Earnings fetches getPowerRewardOverview on open or manual Refresh, with an
in-flight guard and request spacing. No periodic polling or financial action is
exposed. The client Claim button is disabled, and the existing server payout gate
remains closed. Historical uncertain reservations are untouched.

| Display | Authoritative field / meaning |
| --- | --- |
| Remaining Reward Budget | budgetRemainingUnits, accounting ledger; **not** the live platform pool |
| Today's GH Budget / Participants | dailyBudgetUnits / participantCount |
| Today's Calculated GH Share | dailyShareUnits, accounting allocation, not a receipt |
| Current Window Allocation | currentWindowUnits, not presently claimable |
| Pending Review | pendingReviewUnits, unconfirmed reserved amount |
| Confirmed Lifetime GH Received | paidTotalUnits, confirmed grants in the game ledger |
| Reward timing / Last Updated | UTC window fields and server update time when supplied |

No authorized live shared-pool balance source is available to this game UI.
It explicitly says "Live pool balance unavailable". Missing values stay unknown;
invalid responses produce an error and retain any previous data as stale. A
calculated allocation is never replaced by a misleading claimable zero.

PROD overview was read on 2026-10-15 without calling any grant or claim handler.
The current DEV revision does not allow that overview handler, so DEV Earnings
correctly shows data unavailable. Details and captured aggregates are in
[Earnings history](feature-history/jury-earnings.md). No new backend publication
or production deployment was performed.
