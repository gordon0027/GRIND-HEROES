# Combat Skills V1

The active `StageRun` simulation owns automatic skills for Knight, Archer and Mage.
`combatSkills.ts` holds skill balance and visual constants; `GrindScene` and
`SkillEffects` only present simulation events. The legacy `battle.ts` is unused.

Knight's Crushing Blow replaces a normal swing every 8 seconds when in melee
range. It uses the normal attack/defence result multiplied by 2.5, with the
existing sword impact delay and target/reach validation. Archer's Rapid Fire
starts with an in-range shot, triples attack cadence for 3 seconds, and uses
faster tinted arrows. The 14-second cooldown starts at activation, and the buff
cannot stack. Mage's Meteor Fireball replaces an in-range orb every 12 seconds.
It preserves an impact lane coordinate so the projectile still explodes if its
selected enemy dies; each living enemy within 0.19 lane units takes one normal
attack/defence result multiplied by 1.8. Ordinary arrows and orbs still cancel
on a dead target.

Cooldowns and buff duration advance only from capped StageRun simulation steps.
They persist through normal encounter transitions, live bench changes, and the
automatic next run after a clear. A defeat or retry resets them. Death and defeat clear temporary effects;
the existing run lifecycle clears projectiles. Phaser draws compact skill bars
near hero HP bars, class-specific anticipation/impact effects, a temporary
Archer aura, Meteor trail and ground fire. Transient graphics use the existing
bounded feedback tween set and are destroyed on scene reset.
The scene waits for an Act's animations before drawing newly loaded enemies;
asset readiness checks include the sheets as well as the background.

No Title configuration, economy, pet stats, rewards or backend contract changed.
The simulation tests cover damage, cadence, AoE, target death in flight,
simultaneous casts, transitions and retry. Browser QA preview is DEV only and
does not grant progression or rewards.

## V1.1 visual feedback

The hero skill cooldown now uses the same 46 px metal-framed Graphics layer as
the HP bar, directly above it. Its 4 px gray fill is calculated from the live
`skillCooldown` and class cooldown, so an empty bar matches activation and a
full bar waits for a valid target. The Archer aura reads the live buff state.
Regular enemy HP uses one shared red fill; boss and hero styles are unchanged.

Crushing Blow has a larger golden impact arc, flash and ground ring. Rapid Fire
has a brighter green activation burst and a persistent aura while the buff is
active, plus a longer empowered-arrow trail. Meteor has a larger fireball,
brighter trail embers and a layered impact with ground fire. Short skill effects
retain world anchors while the camera scrolls. Feedback objects remain capped
and are cleaned up on scene reset. DEV render diagnostics expose cast counts and
cooldown seconds for runtime QA, with no new timers or simulation changes.

## Hero Active Skill UI V1

The Inventory hero stats dialog shows an informational Active Skill card below
combat stats. It uses the same fantasy panel framing and keeps equipment controls
in their existing layout. Knight, Archer and Mage have distinct code-drawn icons
and colors. AUTO means the skill fires in combat without player input; there is
no equip, unlock, upgrade or manual-cast control.

`activeSkillPresentation.ts` formats damage, speed bonus, duration and cooldown
from `combatSkills.ts`; only prose and visual identity live in the UI. The roster's
`ClassID` values are Warrior/Ranger/Mage, while skill config is keyed by playable
hero IDs Knight/Archer/Mage, so the card receives `hero.id`. The dialog can scroll
on short screens and remains independent of current party formation. Combat
simulation, stage state and Title data were not changed.

## Live roster class mapping fix

The Title roster reports ClassID `Warrior` for Knight and `Ranger` for Archer.
DEV combat QA used hero IDs as class IDs, so those two skills worked in preview
while live formation had no matching skill or cooldown bar. `IdleSession.syncParty`
now resolves the combat class from the playable hero ID when it creates a
`StageRun` source. The roster's original ClassID remains available for other
systems. Combat skill tests use the live roster values before that mapping.
