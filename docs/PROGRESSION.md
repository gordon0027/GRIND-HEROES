# Hero progression

## Two independent tracks

| Track | Earned with | Purpose | Cap |
| --- | --- | --- | --- |
| Hero Level | GOLD through native iDos upgradeCharacterLevel | Base combat stats and skill milestones | 10 |
| Stage Mastery | Server-awarded battle XP | Equipment rarity eligibility | 30 |

Character.Level is retained in the native iDos character record. No player
levels, XP, equipment or party ownership were reset for October 2026 release. Legacy
stat enhancements remain a separate native system and are included in effective
stats when owned; they are not required by the main balance scenarios.

## Hero Progression window

Use Upgrade Hero in Inventory or Team. Upgrades shows the next cost, current and
next Attack/HP/Power, current GOLD and next skill. Skills shows all three milestones,
requirements, automatic behavior and cooldown/activation conditions. The window
blocks background interaction, scrolls internally and restores focus on Escape
or Close. Arrow keys switch its tabs.

The upgrade uses an absolute target and one in-flight guard. Success is shown
only after the native server confirms the level. Authoritative roster/inventory
reads reconcile the result. Read failures get bounded retries; Refresh Hero can
recover without repeating the upgrade purchase. Until reconciliation succeeds,
further upgrades stay locked.

## Skill milestones

- Level 5: Knight Crushing Blow, Archer Rapid Fire or Mage Meteor.
- Level 8: Guardian's Resolve, Piercing Precision or Scorching Impact.
- Level 10: Knight strike 250% → 275%; Archer duration 3 → 3.5 seconds; Mage Meteor 180% → 200%. Cooldowns stay unchanged.

Milestones share progressionSkills.ts. Both actual combat casts and Phaser
cooldown bars require Level 5. Locked skill cards never claim to be ready.

**Compatibility:** V1 had signature skills at Level 1 and passives at Level 5.
October 2026 release retains levels but moves signatures to 5 and passives to 8. Existing
Level 5–7 heroes retain their signature; their former passive becomes available
again at Level 8. This is a gameplay transition, not a data migration.

## GOLD ladder

| Target level | GOLD |
| --- | ---: |
| 2 | 500 |
| 3 | 750 |
| 4 | 1,125 |
| 5 | 1,688 |
| 6 | 2,532 |
| 7 | 3,797 |
| 8 | 5,696 |
| 9 | 8,543 |
| 10 | 12,815 |

Prices come from the native Title ladder. L1→5 costs 4,063 GOLD. The initial
500 GOLD covers the first upgrade. The tested L3/Common 1-3 farm yields about
153 GOLD/minute, so the remaining 3,563 GOLD takes about 23.3 active minutes;
AFK alone takes about 148.5 minutes at 24 GOLD/minute. These are estimates without
other spending or chest luck. Level 5 is not promised in the two-minute demo.

## Balance evidence

Eight real-config profiles, all 30 stages and three deterministic tick cadences
produce 720 runs. See [balance history](feature-history/balance-verification.md) and
[full metrics](../artifacts/release-evidence/balance-after.json). No RNG is involved;
victory rates measure agreement across cadences, not random win probability.

At 50 ms, the L5/Common Knight clears 1-10 in 102.5 seconds. With identical stats
but its signature disabled, it loses. Without gear it also loses. L3/Common loses
1-10. A weak Common trio loses late Act 2; an L10/Epic trio farms the full campaign.
