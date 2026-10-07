# Hero ownership and party slots V1

## Per-run Hero XP eligibility V2

CloudCode starts each validated run with a fresh per-hero participation map.
Only owned heroes assigned to purchased party slots enter its active snapshot.
At each live formation sync, it closes the previous interval, preserves each
hero's accumulated milliseconds, and starts the next snapshot. The iDos
formation record's server `UpdatedAt` bounds a late sync, so delaying the sync
does not extend a removed hero's time. If several formation-record versions
change without a run sync, CloudCode conservatively credits no one during the
unknown interval. Completion closes the last interval.
If iDos omits the record version, a changed server `UpdatedAt` also makes the
unverifiable interval fail closed; earlier verified time is preserved.
Completion checks the formation record version and timestamp even when its
final slots equal the starting slots, closing a leave-and-rejoin gap that was
never synced during the run.
Eligibility requires **at least 5,000 ms and at least 25%** of the validated
server run duration. Both requirements apply independently to each hero.
Several intervals in one run add together. A qualifying removed hero keeps
credit; a bench hero or a late joiner below either threshold receives zero.
Each eligible hero still receives the full stage XP reward.

Failure clears the participation map without an XP grant. Starting another
stage replaces the old active run marker; the old run ID cannot complete.
Completing the same run ID twice cannot repeat Gold, chests or XP. The clear
response includes `xpAwards` for Level/XP UI updates and `xpEligibility` with
server-measured milliseconds, ratio and reason for test diagnostics. The
client never supplies an accepted XP amount or deserving hero list.

Combat and death remain simulated in the browser, so CloudCode has no trusted
death timestamp. V2 uses verified **active formation time** as its practical
participation measure. A dead hero can still qualify, but time after death
cannot yet be excluded securely. A client-supplied death timestamp would not
solve this authority limit; server-validated combat would be needed.

## Per-hero stage XP V1

iDos Character already stores `Character.Level`, which this project uses as a
paid rank for stat curves, equipment limits and Power. Its `Experience` field is
reserved by the platform and the SDK has no server-side stage-XP grant action.
Stage-earned hero Level and current XP therefore live per hero ID in the
server-written ReadOnly custom-data key `grind_hero_xp_v1`. This level is shown
in Inventory and Team; Character rank continues to drive combat and Power.
Freshly recruited heroes default to Level 1, 0 XP without changing another hero.

The stage catalog mirrors CloudCode's server reward: 25 XP for 1-1, plus 5 XP
per stage ordinal. Each eligible hero gets the full amount. The XP curve is
`50 + 30 × (level - 1)` for the next level, capped at Level 30. Overflow can
cross multiple levels; the cap shows MAX LEVEL. `completeStageRun` computes XP
inside the existing validated run flow and batch-writes the closed run marker,
stage progress and the per-hero XP map. The same run ID cannot award twice.

The server records formation intervals at run start, each persisted formation
sync and completion, using the server's formation-record `UpdatedAt` when a
sync arrives late. V2 now requires at least five seconds **and** 25
percent of server-observed run time in formation. The server also checks
Character ownership. A late addition cannot collect XP; a removed hero keeps
XP after meaningful participation. Death never clears participation. Formation
changes sync immediately after the iDos write succeeds, and stage completion
waits for pending management writes. Bench heroes receive no XP.

Inventory keeps the current portrait/equipment layout and puts a compact XP
bar with raw XP text inside it. TEAM's roster shows each owned hero's stage XP
level. A successful level-up displays a short game-facing notice. The session
updates its map from the validated completion response and reads it again on
login. The client has no direct grant-XP operation.

On 2026-10-07, the `grind_hero_xp_v1` ReadOnly JSON key was registered on DEV
Title `98JRCAKG-DEV` and the matching CloudCode became active as revision 18.
The local client at `http://127.0.0.1:5181/` reads and displays the new server
data. The hosted client build remains unchanged; no build upload was requested.
The local browser was verified against DEV: a new 1-1 clear gave Knight 25/50
XP, the following clear advanced Knight to Level 2 at 0/80 XP, and a reload
retained that level.

DEV Title `98JRCAKG-DEV` keeps hero ownership in iDos Character and active-party
capacity in the server-written `grind_party_capacity_v2` ReadOnly custom-data key.
The two progressions are independent. Knight starts owned. The DEV Character
configuration charges 2,500 GOLD for Archer and 10,000 GOLD for Mage through
`character.unlockCharacter`, which atomically grants the hero and consumes its
configured price. Existing DEV ownership is preserved. No PROD Title settings
were changed.

DEV CloudCode revision 17 owns party-slot purchases. Its `getPartySlotPrices`
handler returns the temporary tunable costs: Slot 2 is 5,000 GOLD and Slot 3
is 25,000 GOLD. `unlockPartySlot` validates the target, sequential capacity,
and current GOLD before consuming it and writing the protected capacity key.
The client refreshes custom data and inventory after success. Formation remains
in Private `grind_formation_v2`; buying capacity never assigns a hero. A slot
purchase does not invalidate a currently running stage signature. Live
formation and equipment changes now apply to that run after their iDos writes
succeed; see [the stage loop](grind-stage.md).

Inventory and Team use the prepared Knight, Archer and Mage UI portraits.
Inventory's selector shows only owned heroes plus anonymous `+` entries; Team's
roster also lists only owned heroes and a generic Recruit action. The two
screens share one recruitment dialog. The player-wide equipment grid filters
out any item instance assigned to any hero, while equipment slots retain item
inspection and Unequip. The equipment group is centered around the portrait.

The DEV Character definitions also point `Identity.AssetPaths.icon` and
`portrait` to the prepared icons in the staged DEV build. The Character module's
Hero upgrades screen renders these image URLs directly, including the hero
roster, so it matches Inventory and Team. That roster shows owned heroes only;
recruitment stays in the shared Inventory/Team `+` flow.
