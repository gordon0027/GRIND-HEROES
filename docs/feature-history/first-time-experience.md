# First-time experience

The introduction uses the existing Stage 1-1 and continuous autobattle. A separate
stage would require changes to the stage catalog, server run validation, progress
migration and reward routing. The first fight starts through the normal session
activation path after the welcome dialogue, or immediately after Skip. A dedicated
adventure guide now replaces the original inline hints (see V2 below).

The client stores `grind_onboarding_v1` in private user custom data. A player with
existing stage clears sees no introduction. A new player resumes the current step
after refresh; the step is derived from server-backed stage progress, chest inventory,
party capacity, Archer ownership and formation. `skipped` and `done` remain saved.
V2 accepts these original string saves and stores a JSON snapshot under the same
key, including welcome/victory acknowledgements and the actual GOLD receipt.

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

## Adventure guide V2 (2026-10-20)

Removed the old inline guide, its outline classes and the separate PLAY `NEXT STEP`
card. Replaced them with an RPG dialogue using existing hero art, short messages,
eight progress marks and a dedicated Skip action. The welcome waits for LET'S GO;
the battle message is nonblocking and leaves the battlefield undimmed. Victory
shows the GOLD returned by `completeStageRun`, with no new reward call.

The remaining flow spotlights the actual TEAM navigation button, Slot 2, its
purchase confirmation, Recruit Hero, Archer and its purchase confirmation, then
Slot 2 and the owned Archer formation control. Slot capacity, ownership and the
saved Knight/Archer formation drive the transitions. START ADVENTURE saves `done`;
Skip saves `skipped`, removes the overlay and returns to PLAY immediately. Combat
and automatic stage progression continue during all post-welcome steps.

The portal is attached to this game's document body. An SVG mask dims the viewport
by 72% around measured target bounds; the gold ring and mask ignore pointer events.
Capture listeners allow the real target and guide controls, block unrelated
activation, and retain scrolling. Keyboard focus cycles through the real target
and guide buttons; Escape skips. ResizeObserver, DOM changes, captured nested scroll
events and viewport resize refresh the bounds. Missing targets release interaction.
The guide scrolls the target into view and places the dialogue above, below or to
the side, with a compact layout for short iframes.

Verified with real DEV guest accounts in the browser: desktop and 390px iframe
journeys from welcome through saved two-hero formation; refresh recovery before
slot purchase and before formation; completion and Skip remain hidden after
refresh. Also visually checked 320px welcome/slot/purchase screens and a
1000x430 cross-origin iframe, including nested scrolling to Archer. These initial
checks used local clients against DEV. Screenshots are local QA artifacts.
The normal first-stage duration remains about 68 seconds; an isolated shorter
encounter would need a separate server-validated run/reward contract and is
outside this presentation change. No Title configuration or CloudCode changed.

### Production release

After explicit release approval, commit `f946b03` was packaged with PROD settings
and published as v85 (`blded814bb7cdee49c79d8f7cb3bb2e9bd1`, label `Game update`).
The archive includes all 119 files and has no dependency on another build's art.
CloudCode remains at revision 15. Typecheck, guide tests and the release build
passed; the full automated suite and new-player browser journeys had passed
before release. A staged PROD check loaded an existing account and its saved
TEAM without onboarding. The live root then served the v85 JavaScript, with zero
obsolete hint elements, and the public PLAY NOW button opened the updated game.
