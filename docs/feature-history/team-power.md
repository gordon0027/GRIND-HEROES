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
