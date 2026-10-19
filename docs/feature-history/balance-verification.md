# October 2026 release combat balance (2026-10-15)

Balance uses read-only DEV Character curves and all 50 actual item definitions in
`tests/fixtures/dev-progression-public.json`. Eight profiles run through every stage at
25/50/100 ms simulation cadences (720 runs). The engine has no RNG: the reported
victory rates describe cadence robustness, not estimated random win probability.
Profiles explicitly separate GOLD-paid Hero Level from item eligibility via Stage
Mastery. G uses level-10 heroes with Epic gear, without hidden stat enhancements.

The first stage is unchanged. Late Act 1 raises pack attack, Act 2 adds pressure
against Common armour, and Act 3 adds damage and faster ranged pressure. No HP,
GOLD, chest, XP, recruitment, slot, AFK or GH reward configuration changed.
Recommended Power is an advisory farming target: Act 1 80–135, Act 2 240–520,
Act 3 540–740. Skills and composition are not represented by that stat-only score.

At 50 ms, A (L1 bare Knight) clears 1-1 through 1-4 and loses 1-5. B (L3/Common)
loses 1-10; C (L5/Common) clears it, but loses 2-1. D (two L3/Common) loses 2-5;
E (three L3/Common) loses 2-9. F (three L8/Rare) clears the campaign but can lose
its frontline on 3-10; adding the existing Donkey avoids that death. G (L10/Epic)
farms all 30 stages without deaths. Exact metrics, same-stat skill/gear comparisons
and before/after tables are in `artifacts/release-evidence/balance-*.json`.

The first level costs the 500 starter GOLD. Total L1→5 is 4,063 GOLD. Farming 1-3
with L3/Common produces about 153 GOLD/minute: ~23.3 more active minutes after
starter GOLD, or ~148.5 minutes at the existing 24 AFK GOLD/minute. This is an
estimate excluding chest luck, transitions and spending on other systems; level 5
is a visible longer-term goal, not a two-minute demo promise.

The CloudCode stage validator still checks run identity, unlocks, server clock,
formation/equipment signatures and duplicate claims. It does not replay combat.
This change does not add a new client-only completion/grant path. Server reward
amounts and minimum times remain consistent with the client and existing tests.

Play and Stage Map now show current/recommended Power, difference and preparation
advice. Stage Map uses a native dialog with inert background and focus restoration.
