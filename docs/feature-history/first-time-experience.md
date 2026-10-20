# First-time experience V1

The introduction uses the existing Stage 1-1 and continuous autobattle. A separate
stage would require changes to the stage catalog, server run validation, progress
migration and reward routing. The first fight starts through the normal session
activation path. Guidance appears inside PLAY and TEAM, leaving the combat area and
controls usable. Players can visit every section or skip at any point.

The client stores `grind_onboarding_v1` in private user custom data. A player with
existing stage clears sees no introduction. A new player resumes the current step
after refresh; the step is derived from server-backed stage progress, chest inventory,
party capacity, Archer ownership and formation. `skipped` and `done` remain saved.

The first server-validated Stage 1-1 clear grants its usual 100 GOLD, Stage Chest,
first-clear boots and XP, plus 11,000 GOLD for the existing 3,000 GOLD second slot
and 8,000 GOLD Archer prices. The protected Stage 1-1 completion count makes the
extra GOLD available once; repeat clears keep the original reward. No global
unlock prices changed. DEV CloudCode revision 35 and PROD revision 15 contain
this addition.

Combat advances from a session timer when the document is hidden, while Phaser
only paints visible frames. Returning from a suspended tab catches up the current
run in fixed combat steps. Browsers cannot execute timers while fully suspended;
in that case the game resumes on return and can catch up one active run, but it
cannot claim multiple unseen stages retroactively.

The existing starter Stage 1-1 fight takes about 68 seconds for an unequipped
Level 1 Knight in the deterministic combat test, longer than the 30–45 second
first reward target. Shortening it would alter normal combat or stage balance, so this
version keeps the reliable stage behavior. The player can recruit and assign
Archer immediately after the first clear and chest opening.

## Production release (2026-10-20)

The verified client build is live on PROD as v84
(`bld82576866b5ea465f9dda6e0077156437`). PROD CloudCode revision 15 adds
only the one-time Stage 1-1 GOLD bonus to the previous 23-handler source.
Typecheck, tests and the PROD build passed. The staged client loaded an existing
player without onboarding; after release, the live root served v84 assets and
the public PLAY NOW button opened the game. The release did not create or reset
player progress.
