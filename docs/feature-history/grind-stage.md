# Grind Heroes finite stage and progression

## Chest buttons and loot drop popup V1 (2026-10-07)

The two manual chest buttons below the stage progress bar use the existing
`public/assets/ui/chests/stage_chest.png` (wood/silver) and `boss_chest.png`
(blue/gold). They show only art and an `×N` badge; zero stays visible but
disabled. One click still opens exactly one configured iDos Lootbox, guarded
by the session's `lootBusy` flag.

After a successful open and inventory refresh, a newly awarded equipment
instance appears in a compact card below the buttons for 3.6 seconds. The
card uses the same canonical item icon resolver, rarity colors and rarity
frame files as Inventory. A second open replaces the prior card. Open errors
show the existing small HUD error and refresh the inventory count; no guessed
item is shown. Current DEV chest pools contain only equipment items, so an
unrecognized future reward falls back to a short Inventory notice.

## Act 2 / Act 3 enemies, ranged AI and balance V1 (2026-10-07)

The active catalog now contains 30 ordered stages. Clearing 1-10 unlocks 2-1;
clearing 2-10 unlocks 3-1. The existing `grind_stage_progress_v2` key and stage
IDs remain unchanged, so Act 1/2 player records and selected farming targets
survive. `stageRewards.js` mirrors the 30-stage IDs and rewards, but must be
published as DEV CloudCode revision 19. Client build 25 is staged at the DEV
test URL (build `bldf33e6828a78b4ae2864bc0a38bf3772f`); it is not the live
PROD build.

Act 2 uses Orange Goblin simple, fat, archer and heavy sheets plus OrangeOgre;
Act 3 uses Undead simple, archer and heavy sheets plus ZombieOgre. The 9 sheets
and `act2.png`/`act3.png` backgrounds were copied from
`C:/Users/BG/Desktop/GrindHeroes/` into `public/assets/enemies/act2`,
`public/assets/enemies/act3` and `public/assets/backgrounds/stages`. Every
sheet has 12 columns and 4 rows (idle, run, attack, death). OrangeOgre uses
314×261 frames and ZombieOgre 314×260; regular units use 256×256.

Enemy archers fire delayed arrows at the physical frontline. They stop at
0.42 lane range, remain behind living melee allies, and do not kite. The
simulation owns launch timing, travel, damage snapshots, frontline interception
and cleanup; Phaser draws the arrows and animations. The encounter order is
intentional: early simple waves, then mixed guards/heavies and archer pressure,
with four encounters before each boss. Act 1 retains its original content, with
a gentler HP slope after 1-1. Boss HP progresses about 70→208, 230→437 and
465→884 across Acts 1–3; attack, defence and recommended Power increase in
smaller steps. The existing Common/Uncommon/Rare/Epic/Legendary equip gates
remain Lv 1/5/10/15/20. Current DEV item flats already provide noticeable
Attack, HP, Defence and Move Speed steps; these values are not changed here.

Local DEV-only preview controls under MORE can open Act 2/3 stages without
server unlocks or rewards. Returning to Real party restores the previously
selected real farming stage. Normal play still uses server-validated unlocks.

## UI + Items Revamp V1 (2026-10-07)

The live GrindScene and dormant BattleScene share a compact metal-rimmed HP
bar helper. Heroes are green, regular enemies amber, and bosses wider and red.
The boss HP bar appears only beside the boss in the combat scene. React's
`StagePresentation` watches StageRun identity and outcome: a brief brown
shutter opens for each run or selected-stage switch, then a short CLEARED or
DEFEATED banner appears at the actual local result. It is presentation only;
the existing server validation and same-stage auto farming schedule continue.

## Ranged distance and frontline aggro V2

Knight keeps a 0.13 lane range. Archer now fires at 0.58, Mage at 0.47;
projectile speeds and the 0.18-second release delay stay unchanged. A 0.14
lane backline gap and 0.04 slot stagger keep ranged heroes visibly behind a
living melee hero. The existing 12-metre travel cohesion cap stays in place.

StageRun defines the enemy's physical frontline as the active living hero with
the greatest combat-lane x, regardless of hero ID or slot. A melee enemy keeps
its current valid target until another hero leads it by 0.04 lane units, or
until a hero at least 0.015 ahead reaches the enemy's melee interception zone.
The latter check prevents an enemy pursuing the backline through a newly
arrived frontline; the lead threshold prevents tiny overlaps from flickering
aggro. Death and live removal invalidate the old target, while a hero joining
mid-fight takes aggro only after moving into that physical frontline.

## Ranged combat and projectiles V1

Knight remains melee at 0.13 combat-lane units. Archer and Mage are explicitly
RANGED in `heroArchetypes.ts`, with ranges 0.38 and 0.32. Their projectile speeds
are 1.5 and 1.1 lane units per second. StageRun keeps its existing encounter and
enemy AI, but a living melee hero forms a front limit for ranged movement;
Archer and Mage approach only until their own range is reached. With no melee
hero they still stop at range. The persistent world projection shows a ranged
hero retreating behind the frontline while the camera stays forward-only.

Each ranged attack starts the existing one-shot hero animation and stores a
pending shot with an attack/defence damage snapshot. After a 0.18-second release
delay, its visual travels toward the target. StageRun applies damage at arrival.
Cooldown and flight time are independent, allowing overlapping shots. A target
that dies first cancels its shot without retargeting. Benching or equipping the
attacker does not change a shot already fired; a new run clears all shots.

Phaser draws arrows from the transparent bottom-left 128×128 cell (frame 3) of
`ShortWillowBow.png`, copied from the user's HeroEditor4D asset. The source art
points up, so the sprite rotates by the flight-vector angle plus 90 degrees.
The arrow cell displays at 32px; Mage uses a temporary generated 18px red orb.
Origins are configured beside the hero visual data, and projectiles draw above
characters but below HP bars. The gameplay simulation owns all hits.

## Compact top stage HUD V2

PLAY shows an unlabeled progress bar ending at the shared
`assets/ui/icons/boss/boss_icon.png` icon. Stage and boss chest buttons sit in
their own row below the progress frame; chest counts and opening behavior stay
the same.

## Stage Map / Portal UI V1

The old card-grid StageSelection is retired. One StageMap component reads the
20-stage catalog and the existing server-backed progress. On desktop and mobile
it fills the space beneath the live battle in PLAY. On mobile the map scrolls
within that space above the fixed four-button footer. Switching sections does
not unmount the session or Phaser scene.

Each chapter has a connected ten-node route. Nodes distinguish locked,
unlocked, completed, current farming target, chest milestone (stage 5), and
chapter boss (stage 10). The selected node has a green ring and a small
battle-icon party marker. Chapter 2's tab is disabled until 2-1 is unlocked
by clearing 1-10; the map does not select the newly unlocked stage. A node
click reuses IdleSession.selectStage, so the target changes without a Start
control or page reload. The chapter map uses layered CSS terrain over a warm
parchment palette; the frame/button, lock and battle icons come from the
existing UI pack and the chapter boss reuses the project's ogre sprite.

## Continuous farming and manual chests V1

The saved `selectedStageID` in DEV Private `grind_stage_preferences_v1` is the
farming target. The old `loopMode` value is ignored. On login the selected
unlocked stage starts automatically; invalid selections fall back to 1-1.
Validated clears unlock the next stage but repeat the selected one with a fresh
server run ID. Defeats close the run without reward and retry the same stage.
Selecting a different unlocked stage closes the old run without a clear reward.
The stage bar uses `StageRun.distance / stage.length`, and the boss marker uses
the project's ogre sprite. PLAY has no Start, Stop or Loop controls.

CloudCode DEV revision 15 grants one unopened `stage_chest` on every clear and
an additional unopened `boss_chest` on stages 1-5, 1-10, 2-5 and 2-10. The DEV
Item catalog defines both stackable items. `gear_summon/stage` consumes one
`stage_chest`; `boss_summon/boss` consumes one `boss_chest`. The latter currently
clones the original gear pool. Both resolve rewards through iDos Lootbox when
the player taps a chest; opening one does not interrupt farming.

Equipment and formation actions selected during combat are queued until the
run closes, then persisted before the next run starts. This keeps the current
combat snapshot and the server's party signature consistent.

## Enemy art and chapter flow V3

`stageCatalog.ts` now generates 20 definitions (1-1…1-10, 2-1…2-10)
from chapter/stage identity. The generator also accepts later chapter numbers;
the catalog size is content, not a runtime branch. Every definition carries an
environment reference; both current chapters use the existing forest. The first
five former distances are approximately 5× longer (5000/5500/6000/6500/7500m),
with each encounter at the same proportional point. Remaining lengths grow by
150m per stage to 9750m at 2-10. Enemy HP, Attack, Defence and boss HP rise with
stage order; GOLD rises by 8 per stage. Composition alternates two goblins.

The three goblin PNGs are 3072×1024 with 256px frames; the ogre boss PNG is
3600×1040 with 300×260px frames. All four use a 12×4 grid. Rows are
idle, move, attack and death. There is no separate hit row, so hits tint briefly.
`enemyVisuals.ts` configures all four; `GrindScene` renders them through one
sprite map using `WorldPresentation` world coordinates. Enemies face left with
no flip. The former goblin boss is now the third normal enemy, Goblin Brute, in
regular encounters. Ogre Boss occupies the final encounter of every stage at
native 1.0 scale, with the wider HP bar below its feet, clear of the
top HUD. Hero baseline Move Speed and
enemy engagement speeds doubled; Boots still add their existing flat bonus.
Enemy presentation always loops the movement row for a living sprite, including
the upcoming encounter before combat. An actual attack event plays the full
one-shot attack row, then movement resumes; defeat plays death once. Idle stays
defined in the sprite mapping but is not selected during gameplay. This changes
animation only, not world positions, encounter timing, combat, or the camera.
Run animation FPS rose modestly while attack cadence stayed unchanged. The camera
speed bound was lifted only to stay ahead of boosted travel; the dead zone and
projection rules remain the V3.1 rules.

Previously, after a validated clear and iDos lootbox open, `IdleSession` waited
briefly and started the next unlocked stage unless Loop was on. A failed party
stopped progression. Selected stage and Loop preference were stored in DEV
`Private` custom data under `grind_stage_preferences_v1`. Existing V2 unlocks and completion counts map to
1-1…1-5. Old best times remain under their old IDs: the new distances are not
comparable. DEV CloudCode revision 14 contains the matching 20-stage reward
table and keeps the same validation and grant handlers.

## Earlier V2 architecture

The active game route remains `idle-rpg` so the iDos host/lobby and all existing
systems stay connected. `StageRun` is a pure, transient simulation; `GrindScene`
only draws its state. The old template battle code remains in the repository for
reference, but the active route no longer ticks it.

V1 began with only Knight in Slot 1. Party / Formation V2 adds a saved hero assignment
in iDos `UserCustomData.Private` (`grind_formation_v2`) and a distinct, server-written
capacity key in `ReadOnly` (`grind_party_capacity_v2`). Both keys are registered only
for Title `98JRCAKG-DEV`; capacity defaults to 1. Hero ownership still comes from
the Character system. A schema default supplies the initial Knight formation; the
client validates all three assignments before saving or deploying. DEV CloudCode
revision 16 now unlocks capacity for GOLD through a server-side operation; see
[hero progression](hero-progression.md).

Hero identity, rank, HP, attack, defence and base attack speed come from iDos
Character. The Title has no MoveSpeed or attack range stat, so `heroArchetypes.ts`
owns those temporary class values and light cadence/hit multipliers. Every living
hero advances independently, capped at 12 metres ahead of the rearmost living hero.
At an encounter, position and range determine attack timing. Clearing it preserves
each survivor's simulation lane position and travel metres; while running, the
lane position moves toward formation at a rate based on that hero's Move Speed.
The stage distance follows the first arrival and stops in combat. Individual
death persists until retry.

`WorldPresentation` owns persistent visual world coordinates for the party and
enemies plus a speed-bounded `cameraWorldX`. StageRun's normalized lane
coordinates still determine combat timing, while their frame-to-frame movement
advances the same visual world coordinates during combat. Travel adds each hero's
distance delta, with a limited world-space catch-up toward slot offsets of 0,
-30 and -60 metres. The next encounter has a world location and is drawn before
combat activates; activation keeps those enemy coordinates. Phaser projects all
actors with one camera and a fixed 1.3 pixels per visual metre at every viewport
width. The existing mirrored forest scrolls from the camera position, so combat,
clear, resize and the next journey share one continuous background offset.
On desktop (1024px and wider), Slot 1 is the camera reference while alive. The
camera advances only when that hero crosses a fixed 80px right edge relative to
the 36%-width anchor; it never springs back to the anchor after combat or scrolls
backward during normal forward progress. Narrow screens retain the earlier
smoothed follow of the front-most hero, with backward scrolling suppressed.
Viewport changes alter the camera rule and projection but leave world positions
and cameraWorldX untouched until the next normal movement frame.

Previously `stageCatalog.ts` configured five stages, all consumed by the same `StageRun` and
`GrindScene`. Distances are 1000/1100/1200/1300/1500m. Later stages scale enemy
HP, Attack, Defence and boss HP from Stage 1 encounters. The stage picker shows
server-backed unlocks, completion, best clear time and recommended Power. Power
is guidance only. Previously cleared stages remain selectable for farming.

On DEV Title `98JRCAKG-DEV`, CloudCode revision 17 owns the run lifecycle.
`startStageRun` checks the unlocked stage and writes an Internal active marker
with server start time plus formation and equipped-item signatures.
`completeStageRun` accepts only that active run and stage, checks the latest
server-recorded party configuration, a stage-specific minimum server elapsed time (7–11 seconds), and
a 20-minute maximum. It then closes the run and updates ReadOnly
`grind_stage_progress_v2` (unlocks, clear counts, best times). `failStageRun`
closes a failed run without progress or reward. The client cannot write these
buckets. One run ID can be consumed only once; the completion handler has a
per-player rate limit. Stage IDs and reward amounts are defined in CloudCode,
not taken from the completion request. The client catalog mirrors the server
stage IDs and rewards for display, so both files need to be changed together.

The server grants GOLD and one `stage_chest` per clear via
`ApplyResourceOperation`; Stage 1 also grants `traveler_boots` on the first
validated clear. Each operation uses the run ID in its reason so repeated
farming grants a new chest. Previously, the client refreshed InventoryV2 and
immediately opened the chest through `gear_summon` / `stage`. The continuous
farming flow above stores chests until a player opens one. Loot selection
remains on iDos. The old client-callable Reward claims were changed to Auto
and stage-clear quest objectives to ServerApi; CloudCode advances the metric.
The existing idle-GOLD collector remains active, and the legacy wave-progress
key is not flushed on leaving this mode.

Live management V1 applies successful iDos equipment and formation writes to
the current `StageRun` immediately. Each run keeps a hero-ID keyed runtime map,
including benched heroes, so rejoining restores absolute HP, death, cooldown,
target and lane position. Equipment updates replace only derived stats: MaxHP
growth never heals, MaxHP loss clamps HP, and attack cooldown keeps its elapsed
fraction when Attack Speed changes. A newly deployed hero starts once near the
current party; a dead hero remains dead until the automatic new run. The world
presentation retains benched positions while excluding them from camera and
spawn calculations. A living hero returning from a long bench enters at the
current party rear without altering their HP or cooldown. DEV CloudCode's
`syncStageRunParty` updates only the active
run's formation/equipment signatures from persisted server records before a
changed run is completed. Run-ID, elapsed-time, stage and one-time reward checks
remain in place.

Combat still runs in the browser. A modified client can wait through the
minimum time and report a false victory; the server checks run state and
plausibility, not individual hits. Progress closure and resource grant are
separate operations, so an unusual backend grant failure can leave a clear
saved without its reward. A Vite DEV-only runtime preview can deploy 2 or 3
Title heroes without writing ownership or slot unlocks; it grants no rewards
or progression and disappears on reload.

## Combat feel and death presentation V1

The attack row uses frames 24–35. StageRun now distinguishes attack start from
impact: Knight's sword lands near frame 32 (0.444s at 18 FPS), Archer releases
near frame 29 (0.278s), Mage near frame 31 (0.389s), a normal enemy hits near
frame 30 (0.375s at 16 FPS), and the ogre near frame 34 (0.625s). AttackSpeed
shortens both the animation and its event delay when the cooldown is faster than
the natural animation. Melee damage and the matching HP change occur only at
impact; ranged damage still occurs only when its existing projectile arrives.
The live target and reach are checked again at melee impact, so death, removal
and a newly interposed frontline can cancel a pending hit without transferring
damage to a different target. Logical start, hit and death events are also
available for later audio assets.

StageRun removes a defeated enemy immediately from combat and never moves or
targets it again. GrindScene retains only its visual actor with a captured
`deathWorldX`, reprojects that fixed location through the existing camera on
every frame, and removes the actor when the one-shot Death row completes.
Normal and boss enemy death rows run at 16 FPS (0.75s); the post-clear auto
restart waits 0.85s so the boss death can be read before the scene resets.
Regular travel resumes as soon as combat is resolved while the corpse falls
behind in world space. Hero Death remains terminal for the actor's current run;
live party removal destroys the actor without a death animation.

Contact offsets are presentation-only: +7px for the two small goblins, +10px
for the brute and +20px for the ogre. They leave StageRun ranges, camera and
world positions unchanged. Mage is shifted 6px upward, Archer 5px downward;
the V2 0.14 backline gap and 0.04 ranged slot offset remain unchanged. Real
damage produces a 90–120ms tint and a short recoil, plus a small transient
melee, arrow or orb impact ring. Boss hits get a slightly stronger recoil and a
55ms subtle camera shake. Projectiles and impact/text objects are destroyed on
completion and scene reset. Damage, HP, defence, rewards and stage constants
were not retuned; the new wind-up can change which in-flight melee hits resolve
before an actor dies.
