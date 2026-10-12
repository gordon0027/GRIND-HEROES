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
