# Secure Team Power and custom Top 100

Grind Heroes displays `combatPower` from `game/equipment.ts`, which now calls the
single `ghCombatPower` implementation in `game/powerFormula.js`. The CloudCode
publisher prepends that exact function source. iDos `Character.Power` is a
different metric: it includes native equipment that may not be active in Grind
combat. The browser never sends Power, stats, or gear bonuses to CloudCode.

CloudCode reads `grind_formation_v2`, applies server-controlled capacity from
`grind_party_capacity_v2`, verifies character ownership, and loads the protected
Grind equipment assignments. It uses the same title Character stat curves,
Grind gear flat bonuses, stage archetype modifiers, and rounding as the hero
card. Team Power is the sum for occupied active slots only; it can fall when a
hero leaves the party or gear is removed. It is saved as
`grind_team_power_v1` in player `ReadOnly` data (`version`, `power`,
`updatedAt`). The metric is derived from game state; this key is a cache.

The global projection is `grind_team_power_top_v1` in `Runtime.Private`
TitleCustomData. The server stores at most 100 rows. Updates use the title
record's `Version` as a compare-and-swap condition and retry five times after
a conflict. Order is Power descending, then the earlier time at the current
score, then internal player ID. The CloudCode read handler strips player IDs
and returns rank, public profile name/avatar when available, Power, and
`isYou`. Players outside the Top 100 see their current Power and no rank.
If a full Top 100 member drops below its former threshold, its row is removed;
the 101st player cannot be recovered without a larger candidate store, so the
visible list may temporarily contain fewer than 100 entries.

Recalculation runs after formation changes and whenever the game's character
or Grind gear snapshot changes, including login, recruitment, upgrades, equip,
unequip, replacement, and returning to Team/Inventory after external changes.
Opening the leaderboard always invokes a trusted server recalculation for the
current player. The server writes only when the derived score or row changed.
External iDos operations that do not notify this session can leave a row stale
until that player returns or opens the board; V1 does not promise instantaneous
updates for those paths.

The native iDos leaderboard is deliberately unused: `LastValue` supports
decreases but its public `submitScore` trusts a browser-supplied value. A future
CloudCode server-side score writer can replace only the Top 100 publisher while
retaining the authoritative Team Power calculation.

## Daily GH pool reward

The publisher requested a daily payout to every player in the protected Power
Top 100: take 10% of the remaining GH reward budget at the daily snapshot and
split that amount **in proportion to each row's Power**. Higher Power receives
more GH. With equal Power, 1,000 GH and ten rows means a 100 GH daily budget
and 10 GH each. The next day's budget is based on that day's remaining balance.
`Main` has zero decimals in the live Currency definition, so amounts are whole
GH. The whole daily budget is apportioned by largest remainder; if it is at
least the participant count, each participant gets at least 1 GH. If it is too
small to give each one GH, skip the day. Only pool-backed `Main` may be paid;
never substitute `Main_IOU`.

The publisher chose to enter a starting balance once and have the game carry
forward its remaining budget. On 2026-10-08 he specified **40,000 GH** as the
current balance. Each UTC day sets a maximum of 10% of the **unspent** manual
budget. Only claimed windows and the single inactivity credit reduce that
budget; unclaimed windows return to it. The real platform reward pool may
also change for other reasons, so this manual ledger is not a live pool balance.
The platform must reject any unfunded `Main` grant. The game checks that the
`CryptoIouForScriptsAndAI` and `CryptoRewardsFromDeveloperShare` policies remain
false and never grants `Main_IOU`.

The seed lives in PROD `Static.Private.grind_power_reward_seed_v1` with
`initialPoolUnits: "40000"` and `payoutsEnabled: true`. The ledger is in the
registered `Runtime.Private.grind_power_reward_state_v1` key, allowing a
131,072-byte value for up to 100 ranked players. It records the UTC day,
frozen Power shares, unspent budget, each player's claimed windows, at most
one pending inactivity credit, and an in-flight claim lock.

Each day has three windows: 00:00–08:00, 08:00–16:00, and 16:00–24:00 UTC.
The day's 10% maximum is split among all players in that day's Power snapshot,
proportional to Power. A player may claim that window's third on login,
subject to an eight-hour cooldown from the previous GH claim. For a 100 GH
daily share, whole-token windows are 33, 33, and 34 GH. Missed windows expire.
If the player claims none that day, one 33 GH inactivity credit is preserved;
further quiet days do not stack more thirds until the player returns and
claims. An uncertain or rejected grant leaves its in-flight lock for manual
reconciliation, so retrying login cannot double-pay it.

`server/powerRewardPlan.js` implements integer-string daily allocation and
rejects malformed or duplicate participants. `server/powerRewards.js` closes
elapsed days before any Team Power projection changes. Thus the next normal
server request reconstructs quiet days against the last protected leaderboard;
it credits at most one missed-day third per absent player. The server stores
the day and claim locks with compare-and-swap writes. Tests cover weighted
Power, rounding, empty and insufficient budgets, one/two/three windows,
several quiet days, claim locking, and IOU-policy rejection.

CloudCode revision 10 includes the eight-hour reservation and claim handlers.
Client build v56 is live and rechecks the reward while a session stays open.
The Title's
`ResourcePolicy.AllowedGrantTypes` includes `CryptoCurrency`. The daily
schedule `grind_power_rewards_daily_v1` is configured for UTC midnight, but
the iDos dashboard says CloudCode automation requires the Start tariff, so the
schedule does not execute on the current plan. The catch-up implementation
does not drop empty-traffic days: their entitlement is computed on the next
server request. The first live state appeared at 2026-10-08 18:01 UTC: twelve
Power rows, 4,000 GH daily maximum, 40,000 GH still unspent. No player had
claimed GH by the 18:03 UTC read-back, so a successful real `Main` grant still
needs confirmation after the next eligible player enters on the new build.

## Earnings panel and live payout status

Build v60 added an `EARNINGS` button to the base game's header, beside the
GOLD/GEMS/GH balances. It opens a responsive overlay with the manual unreserved
GH budget, today's 10% maximum, current live Top 100 rank and Power, the
player's frozen daily Power-weighted maximum, current 8-hour window amount,
saved one-third absence credit, and confirmed lifetime GH grants. CloudCode
revision 11 added `getPowerRewardOverview`; it returns only the authenticated
player's amounts and public aggregate figures, never the protected Top 100
player IDs. Revision 12 also returns each authenticated player's reserved,
unconfirmed claim amount. Opening the panel fetches once and offers manual refresh to avoid
aggravating CloudCode rate limits. The wording makes clear the 40,000 GH seed
is a manually entered accounting budget, not a live platform pool balance.

The first production read-back after those releases showed two in-flight
claims totaling 262 GH and zero grants confirmed in the game ledger. The
owner's account displays `review_required`. The locks intentionally prevent
another grant attempt until the actual platform result can be reconciled;
do not clear them or retry blindly. The latest panel update exposes each
player's reserved, unconfirmed amount and labels the displayed remainder as
unreserved budget. A full 27 MB v59 upload hit the Title storage quota, so
`scripts/optimize-deploy-pngs.py` reduced deploy-only sprite PNGs to a 10.7 MB
complete build without changing source assets; v60 includes all 113 game files.
The underlying cause of the failed or unfinished crypto
grant was not available through the connected MCP or dashboard API metrics.
