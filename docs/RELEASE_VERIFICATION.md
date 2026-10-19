# October 2026 release verification

Recorded 2026-10-15; current repository synchronization reviewed 2026-10-19.
This is a historical verification record. The published client is now **v83**,
which superseded v82 with a direct Shop button. No game deployment is part of
the repository documentation update.

## Release scope

The v82 release added the equipment-first Inventory, a separate Hero Progression
dialog, automatic Level 5/8/10 skill milestones, stage preparation cues and a
read-only GH Earnings presentation. It retained existing player levels, Stage
Mastery, equipment and party ownership. Currency prices, token contracts,
reward formulas and payout locks were not changed. v83 added direct Shop access
in the game header. [Production release history](feature-history/production-release.md)
and [Shop history](feature-history/shop.md) record those deployments.

For neutral repository presentation, the public copy of the v82 release record
uses a normalized display label and path. Build identifiers, metrics and
verification outcomes are unchanged.

The Inventory shows six equipment slots, comparison and Equip Best. Inventory
and Team open the same Hero Progression dialog. Play and Stage Map show Team
Power against recommended Power; that recommendation is advice, not an
eligibility rule. Dialog keyboard behavior, focus restoration, mobile layouts
and an upgrade read-back recovery were verified. A failed state read retries
only the read; it cannot repeat a GOLD purchase.

## Progression and balance

| Hero Level | Combat behavior |
| --- | --- |
| 1–4 | Normal attacks; signature and passive abilities remain locked. |
| 5 | Crushing Blow, Rapid Fire or Meteor activates automatically. |
| 8 | Guardian's Resolve, Piercing Precision or Scorching Impact becomes available. |
| 10 | Signature mastery improves the class ability without changing its cooldown. |

The transition preserved existing hero records. Level 5–7 heroes kept their
signature, while the former passive now unlocks at Level 8. Tests covered
boundaries, cooldowns, shield and burn effects, and mastery. A live DEV Knight
was upgraded to Level 10; class effects beyond that browser run were also
checked by simulation. [Progression details](PROGRESSION.md).

The balance audit used DEV definitions for three characters, 50 items and
their stat curves: **eight profiles × 30 stages × three deterministic
simulation cadences = 720 runs**. No random victory probability is inferred
from these results.

| Profile | Verified outcome across cadences |
| --- | --- |
| Starter Knight, no gear | Clears 1-1 through 1-4; first loses at 1-5. |
| Level 3 Knight, Common gear | Clears through 1-9; loses at 1-10. |
| Level 5 Knight, Common gear | Clears Act 1; loses at 2-1. |
| Two Level 3 heroes, Common gear | Loses at 2-5. |
| Three Level 3 heroes, Common gear | Loses at 2-9. |
| Three Level 8 heroes, Rare gear | Clears all 30; the front line can fall at 3-10. |
| Three Level 10 heroes, Epic gear | Clears all 30 without deaths. |
| Level 8 Rare trio with Donkey | Clears all 30; the pet prevents a front-line death at 3-10 in the 50 ms run. |

At stage 1-10, the Level 5/Common Knight wins in 102.5 seconds but loses with
the signature disabled or the gear removed. The tuning changed later-stage
enemy pressure and recommended Power, while GOLD, XP, chest pools, prices and
server minimum clear times remained unchanged. [Before](../artifacts/release-evidence/balance-before.json)
and [after](../artifacts/release-evidence/balance-after.json) metrics include
clear time, deaths, damage and farming estimates.

The 500 starter GOLD covers Hero Level 2. Level 5 costs 4,063 GOLD total from
Level 1, so it is a longer-term objective. The measured Level 3/Common farm
estimated about 153 GOLD/minute; these figures do not assume lucky loot or
skip recruitment and party slot costs.

## GH Earnings safety

The Earnings interface separates the accounting budget, today's planned
budget, calculated share, current window, pending review and receipts
recorded as confirmed in the game ledger. It says when a live shared-pool
balance is unavailable. The client Claim action and PROD CloudCode claim
gate are disabled; uncertain historical reservations were not modified.

On 2026-10-15, a read-only PROD overview showed 36,164 GH remaining in the
manual accounting ledger, a 3,616 GH daily plan and 73 participants. This is
a dated snapshot, not a current pool balance or proof of token transfers.
The isolated read-only account had no allocation or confirmed receipt.
[Captured read](../artifacts/release-evidence/earnings-prod-read.json) ·
[Payout gate audit](../artifacts/release-evidence/payout-safety-audit.json).

The UI was checked against ten explicitly labelled offline states, including
an allocation, pending review, stale data and rate-limited refresh. No grant
or claim handler was invoked. [Visual results](../artifacts/release-evidence/earnings-visual-qa.json).

## Browser and live DEV verification

Layouts were checked at widths 320, 360, 390, 430, 768, 1366 and 1920 px.
Inventory, Team, Play, Hero Progression, Skills, Marketplace and Earnings were
captured. Keyboard, focus and dialog behavior were checked separately.
[Screenshot index](../artifacts/release-evidence/screenshots.json) ·
[Geometry](../artifacts/release-evidence/responsive-geometry.json) ·
[Keyboard](../artifacts/release-evidence/keyboard-qa.json).

A fresh DEV guest cleared 1-1, received a Stage Chest and Traveler Boots,
opened earned chests, equipped gear, upgraded a hero and reached an authentic
early defeat with a return to farming. Separate DEV accounts were used for
later levels and purchases; those test funds do not represent fresh guest
progress. An isolated live SDK stage run confirmed 100 GOLD, 35 XP and one
chest for 1-1 in about 68 seconds, with early and duplicate completion
rejected. [Stage run](../artifacts/release-evidence/live-stage-dev.json) ·
[Upgrade checks](../artifacts/release-evidence/live-progression-dev.json).

The v82 PROD smoke check loaded combat, Inventory and Hero Progression on an
existing account. The public iDos app opened the login screen in its iframe.
It did not run a new account's full PROD progression, GH purchases or token
transfers. The 119 hosted resources responded with HTTP 200 in the release
audit. [CDN audit](../artifacts/release-evidence/prod-cdn-audit.json) ·
[Live dialog](../artifacts/release-evidence/prod/live-progression.png).

## Verification limits

- The 30-stage coverage is deterministic simulation, not 30 manual live clears.
- Browser viewport checks do not establish physical iOS or Android behavior.
- Marketplace settlement was regression-tested, without a fresh live
  multi-buyer stress test in this release.
- The external demo videos were recorded before the current v83 build.
- GH reward calculations and UI states do not establish a working claim or
  a confirmed on-chain payout.
