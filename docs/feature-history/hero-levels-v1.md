# Hero levels and game polish V1

Hero combat level is the native iDos `Character.Level`, upgraded atomically with
`upgradeCharacterLevel(id, { targetLevel })`. One session-wide in-flight gate
and an absolute target prevent double clicks and stale retries from buying two
levels. Any uncertain response is followed by authoritative roster/inventory
refresh; failed reconciliation keeps upgrades disabled until reload. No custom
client save, new XP store, or CloudCode currency mutation was introduced.

The existing stage-earned XP record remains intact and is now labelled Stage
Mastery. It still gates Common–Legendary equipment at 1/5/10/15/20. It does not
unlock progression skills. This preserves existing equipment and earned XP.

V1 changes the native ladder to ten levels. Target levels 2–10 cost GOLD
500, 750, 1125, 1688, 2532, 3797, 5696, 8543, 12815 (ceil of 500 × 1.5^n).
RankStatCurve changes from 25% to 4% per level of base stats; gear/pet bonuses
are added afterward. This is a deliberate balance change: existing paid ranks
are retained but their rank multiplier becomes lower. Native stat enhancements,
hero ownership, formation, equipment and XP are not migrated or deleted.

Only a Character definition with MaxRank=10 enables V1 skill milestones.
The existing CloudCode Power calculation already reads native Level and the
same curves and is identical in DEV revision 34 and PROD revision 14. No
CloudCode or GH payout rules need publishing. Team Power remains the existing
stat-derived metric; transient shield, burn and skill cooldowns are not Power
inputs. This preserves its meaning and avoids altering reward formulas.

Level 1 keeps all original active skills. Level 5 adds Guardian's Resolve
(below 30% HP, absorbs 15% max HP for 4 seconds, once per run), Piercing Precision
(every fifth attack does 1.4× damage), and Scorching Impact (three one-second
ticks of 12% Attack, rounded, minimum 1 damage; refreshes rather than stacks).
Level 10 changes Knight's active multiplier 2.5→2.75, Archer duration 3→3.5s,
and Mage multiplier 1.8→2.0. Cooldowns stay 8/14/12 seconds.

Transient counters live in StageRun. Retry/new run resets passives; benching
does not refresh the shield. Burn belongs to its target, never retargets and
cannot leak into the next encounter. Projectile damage snapshots include the
milestone state at launch. VFX reuse existing graphics and empowered arrows.
The local-only DEV combat panel can select skill levels 1/5/10 without writes.

Shared RPG tokens live in ui.config.ts. Shared polish.css handles safe areas,
touch targets, focus outlines and narrow layouts. useDialogFocus is shared by
hero/purchase dialogs and Earnings; native ShopDialog already provides modal
containment. Inventory and Team reuse HeroProgression with cost/stat previews,
locked milestones, maximum level and confirmed upgrade feedback.

Verification: `npm test` includes heroProgression.mjs. The opt-in
`GRIND_DEV_PROGRESSION_PROBE=1` test uses a new DEV guest, tests an unowned hero,
concurrent target upgrades, insufficient funds, exact costs through level 10,
cap/replay, state reload and server/client Power parity. It spends only that
guest's starter DEV GEMS on the existing GOLD offer; never run it on PROD.
Public custom data with the same key name is possible but has no influence on
ReadOnly Power or native Character.Level; the regression verifies this.

Read-before-write configuration backups and browser evidence are under
artifacts/hero-progression. The Russian release report records deployed build
identity and remaining verification limits.

## Jury Edition progression (2026-10-15)

Inventory and Team now open one reusable native Hero Progression dialog. Inventory
keeps equipment and the bag visible before Premium Chests; a compact upgrade
button replaces the inline progression sections. Native dialog containment blocks
background interaction and restores focus; its header remains outside internal
scrolling. Upgrades still use HeroUpgrade and the atomic iDos target-level flow.

Milestones in progressionSkills.ts are now signature active at 5, passive at 8,
and mastery at 10. Levels and XP are retained. Existing level-5–7 heroes keep
their signature active but their former level-5 passive returns at level 8.
All active casts and Phaser cooldown bars require the shared level-5 check,
including older environments. Passives/mastery still require the supported ladder.
No Title configuration, GH reward rules or payout gates changed.

Verified: typecheck, complete npm test, build; real DEV UI at 390 and 1366 px.
Boundary tests exercise normal attacks without skills at 1/4, actives at 5,
locked passives at 7, passives at 8 and mastery at 10.

Browser QA found a confirmed upgrade whose roster/inventory read-back failed.
HeroUpgrade now retries only those reads at bounded delays and exposes Refresh
Hero after exhaustion. The upgrade write remains locked until state is confirmed;
manual recovery never replays a purchase. The button no longer implies an endless
pending purchase. Unit tests cover transient recovery, persistent failure, blocked
writes and successful read-only manual recovery.
