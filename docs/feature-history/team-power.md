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

## 2026-10-09 payout investigation (local only)

PROD Title `98JRCAKG` still serves client v60 and CloudCode revision 12. The
protected `grind_power_reward_state_v1` read at 2026-10-09 14:21 UTC held **seven**
in-flight claims totaling 1,229 GH, all with `paidUnits: "0"`; the two first
claims (180 and 82 GH, reserved 2026-10-08 18:04:57 and 18:07:57 UTC) remain
among them. The public Title page showed about 46.52K GH in the player pool
and 160 GH in the developer pool at the time of inspection. These are live
platform figures, distinct from the game's manual 40,000 GH accounting seed.
The live Currency config has active zero-decimal `Main`, both crypto IOU
fallback flags false, and CloudCode `ResourcePolicy.AllowedGrantTypes` includes
`CryptoCurrency`. The public pool figure is not proof that a particular
CloudCode grant succeeded or that its funding rule selects that pool.

The active code sends `server.ApplyResourceOperation({ Reason: claimID,
Operation: { Grant: { Standard: { Entries: [{ Type: "CryptoCurrency",
CurrencyID: "Main", Amount: wholeGH }] } } } })`. The official iDos registry
describes this resource entry shape and says `server.*` calls return
`{ Success, Error, Data }`, but it does not document `Reason` as an
idempotency key. Treat `Reason` as a correlation label only. The title MCP
exposes active config and protected TitleData, not historical CloudCode
execution results, player `Main` inventories, grant transaction records, or
the exact platform grant response. PROD has `PersistExecutionLog: true` with a
30-day TTL, but no available MCP reader for those records. The dashboard's
Cloud Functions page shows the schedule and its plan restriction, not an
execution log; API Metrics aggregates `CloudCode.Execute` without handler,
claim ID, or response detail. Consequently the
seven claims are **unknown outcomes**, not proved failed payouts. No historical
reservation was changed and no grant was retried.

Local `powerRewards.js` now stores the claim day, one-based window, frozen
daily share, amount split between saved inactivity credit and current window,
and previous claim timestamp with each new reservation. It logs a one-way
diagnostic claim key around the grant and finalization, with the response's
field names and a transaction/operation ID if the platform supplies one;
player IDs and raw claim IDs are omitted from logs. The new internal
reconciliation helper supports a confirmed-success finalization for old or
new reservations, a confirmed-rejected rollback **only** for new reservations
with intact amount-source metadata, and an unknown no-op. It is not exposed as
a player-callable handler. Old reservations lack the amount split, so a
rejected old grant needs manual reconstruction from a protected historical
snapshot and independent platform evidence; if either is unavailable, leave
the lock in place. The nonce never decreases or reuses a claim ID.

Recovery requires a publisher/platform read-only audit per claim ID/Reason,
recipient, `Main` amount and reservation time, plus the player's trusted
`Main` balance/transaction history. If the grant is confirmed, apply a
compare-and-swap ledger finalization to move its reserved units into
`paidUnits` without calling `ApplyResourceOperation`. If the platform proves
rejection, reconstruct the original inactivity/window split, previous
timestamp and day from records, then apply a reviewed CAS rollback; never
infer this from today's snapshot. If the result is missing or ambiguous, keep
`inFlight` and escalate to platform support. A live controlled test also needs
access to the execution result and balance/transaction evidence before any
approval to publish or grant.

## 2026-10-09 one-GH controlled probe preparation

The official iDos CloudCode skill and the publisher tool's `server.*` API list
do not include `server.ApplyResourceOperation`, although the current PROD
revision calls it. This is a **suspected** API mismatch, not the historical
execution result. The reward-system skill describes native static Claims using
`ResourceGrant` but does not establish a server-calculated Power amount or
publisher-funded `Main` CryptoCurrency payout route. `Reason` remains a
correlation label, not a proven idempotency key. `Main` is active, the
CloudCode policy allows CryptoCurrency, and `CryptoRewardsFromDeveloperShare`
is false. The 46.52K GH player pool and 160 GH developer pool shown by the
publisher dashboard do not prove which pool a script grant would debit.

Local `server/oneGhPayoutProbe.js` adds a fixed-account, exact-one-GH test
handler and a read-only status handler. The recipient ID is intentionally blank
in source, so an accidental publication cannot run it. Before making the
platform call, the server writes an independent permanent CAS lock to
`Runtime.Private.grind_main_one_gh_probe_v1`. The title currently sets
`RejectUnregisteredKeys: false` and a default 8,192-byte value limit, so this
small protected record can be written without changing the existing Power
reward key schema. The handler ignores browser arguments, returns a redacted
platform response only to its fixed account, and never clears its lock on a
rejection or unknown result. The browser reads `InventoryV2.CryptoCurrencies.Main`
before the click and again afterward, looking for exactly +1 GH. It does not
infer a payout from a successful CloudCode transport response.
The status handler also reports whether the runtime exposes
`server.ApplyResourceOperation`; if absent, the test button stays disabled and
the grant handler returns `unsupported_api` before writing any lock.

`scripts/prepare-gh-probe.mjs` pins the fetched PROD revision 12 source hash,
replaces only its Power reward tail with the local protected version, appends
the temporary probe and builds an ignored `.tmp/gh-prod-one-gh-probe.js` draft.
The local source has no authorized UserID until the draft builder inserts the
fixed account. The draft passed `node --check`; its actual publication and
test result are recorded below. The new Power handler and Earnings client both
leave regular claims disabled until the real test is verified. The local game
no longer calls `claimPowerRewards` at login or on its eight-hour timer;
protected Power recalculation remains. Earnings now has a manual Claim button
and a simpler six-field layout, but the button stays disabled while the probe
is pending. After a successful test, a separate reviewed release must switch
both claim gates on and remove the temporary probe. All seven historical
in-flight claims remain untouched.
Typecheck, the full test suite, production build, syntax check of the
publisher draft, and `git diff --check` passed. Browser inspection at 390 px
used a temporary local overview fixture to verify the six-field layout and
disabled Claim button; the fixture was removed immediately afterward. The
real local DEV CloudCode does not whitelist `getPowerRewardOverview`, so that
browser run cannot verify live reward figures or the actual payout animation.
An optimized, local-only PROD-targeted preview package is prepared at
`.tmp/gh-one-gh-prod-preview.zip` (8.64 MB). Its bundle explicitly contains
`VITE_IDOS_ENV: "prod"`; the ordinary local build defaults to DEV. The zip was
uploaded as Staged client v61, never deployed to the live slot. The temporary test UI is requested with
`?ghProbe=1`, reads the protected status after the overview to avoid immediate
CloudCode throttling, and appears only when the fixed account is authorized.

## 2026-10-09 PROD one-GH result

The publisher explicitly authorized one real-GH test on the authenticated
`[redacted publisher UserID]` account. PROD CloudCode revision 13 was published
with the 19 existing handlers plus two temporary probe handlers. It keeps
`GH_POWER_REWARD_CLAIMS_ENABLED = false`, so live client v60 cannot create more
Power claim reservations. Client v61 was uploaded as **Staged** only; live client
remains v60. The staged PROD preview ran under the account shown by the iDos
profile as `[redacted publisher UserID]`.

The authenticated, read-only status handler reported that
`server.ApplyResourceOperation` exists in the PROD runtime. The account's
`Main` inventory was 840 GH before the attempt. Exactly one probe call
reserved a separate permanent key, `Runtime.Private.grind_main_one_gh_probe_v1`,
then submitted:

```json
{"Reason":"grind_main_one_gh_probe_v1:[redacted publisher UserID]","Operation":{"Grant":{"Standard":{"Entries":[{"Type":"CryptoCurrency","CurrencyID":"Main","Amount":1}]}}}}
```

The actual `server.ApplyResourceOperation` response was:

```json
{"Success":false,"Error":"Server-issued grants of crypto 'Main' are disabled for this title.","Data":null,"QuestProgress":null,"TutorialProgress":null,"StateVersions":null,"StateEpoch":null}
```

The probe returned `platform_rejected` with `auditStored: true`. The protected
probe record is Version 2, with attempt at `2026-10-09T15:07:32.332Z` and
rejection at `2026-10-09T15:07:32.362Z`. A post-attempt inventory refresh
still showed 840 GH. Never clear this probe lock or run the handler again.

This proves the current GH grant request is rejected by a title-level platform
gate on **server-issued crypto `Main` grants**. It does not prove the outcome of
the seven earlier Power reservations because their execution responses and
transaction records remain unavailable through the current MCP. They total
1,229 GH, and the protected reward ledger is still Version 9 with `paidUnits =
0`. In particular, the 180 GH historical reservation for the publisher account
was not part of the one-GH probe and remains `review_required`.

`ResourcePolicy.AllowedGrantTypes` already includes `CryptoCurrency`, `Main`
is Active and zero-decimal, and Stage rewards use the same
`ApplyResourceOperation` envelope for GOLD and items. The platform has not
documented an exposed publisher setting or funding route that would enable
server-issued real-crypto grants for this title. Do not toggle
`CryptoRewardsFromDeveloperShare`, enable `Main_IOU`, or release regular claims
without an authoritative platform answer and a **new** separately authorized
controlled test. Keep revision 13's maintenance guard active. The staged v61
client is not ready for live deployment while real `Main` payouts are blocked.

The subsequent comparison of native iDos payout features and a publisher-funded
Solana SPL route, including the six-decimal on-chain mint discrepancy and the
requirements for a separate secure signer, is recorded in
[`docs/gh-real-payout-path.md`](../gh-real-payout-path.md). No further platform
configuration or balances were changed during that investigation.
