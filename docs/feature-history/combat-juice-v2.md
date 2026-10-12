# Combat Juice V2

Combat feedback now shares `CombatJuice`, a presentation controller with a total
budget of 24 transient objects and a separate limit of 10 damage numbers.
Existing skill bursts use the same lifecycle, so impact sparks do not duplicate
the primary Crushing Blow/Meteor burst. Effects and numbers retain world anchors
while the camera moves. Every feedback tween is killed on run reset/shutdown.

Successful `StageRun` hits carry attacker ID, skill ID and damage metadata for
presentation. No damage formula, targeting, coordinate, reward or progression
calculation changed. Normal hits flash white then warm red and recoil 3 px;
heavy regular-enemy hits recoil up to 10 px with a quick return. Boss recoil is
always zero. Existing 12-frame death animations remain intact, followed by an
88% final-pose scale and fade; one bounded dust burst comes from the existing
once-only corpse transition.

Heavy sword impacts hold only involved sprite animation playback for 55 ms;
Meteor hits hold it for 50 ms. Simulation, cooldowns, projectiles and timers keep
advancing. Simultaneous hits share one hold request and cannot extend it; requests
are throttled by 160 ms. Camera shake is throttled by 300 ms and only requested
by heavy successful hits. Reduced-motion mode skips holds, recoil and shake.

The active finite-stage combat has no critical roll or critical result metadata.
Legacy `Battle` contains crit support but is not the live combat pipeline. No
new crit balance or `CRIT!` feedback was introduced. Pets remain decorative combat
companions with passive stat bonuses; attack frames receive a small local lunge,
without a fake damage event or extra damage number.

Validation includes the existing full test suite, a rendering-controller adapter
test for hold expiry, boss stability, effect limits and cleanup, and skill tests
that require landed-hit metadata. DEV browser QA uses the real Phaser/StageRun
pipeline with three heroes, six enemies and a boss, without granting rewards.

Releases v74–77 reused v68 art to fit the storage quota. This approach is retired:
some archived-art routes returned 404 despite the build still existing, while
cached desktop images masked the failure. v78 restores all 115 art files inside
the release itself. Use `scripts/package-web-build.py`, which verifies the public
asset mirror and refuses cross-build dependencies. The old shared-art packager
now refuses to create releases. Do not use a warm browser cache as the only art check.

## Runtime verification (2026-10-12)

- Desktop DEV QA: Knight, Archer and Mage all cast repeatedly in the same real
  StageRun. Six-enemy holds, boss combat and normal stage completion were observed.
  Stage 3-10 finished with 161 hit presentations, 22 heavy hits, 14 visual holds
  and exactly 42 death presentations for its 42 enemies. After cleanup: zero
  transient effects and zero corpses.
- 390 × 844 browser viewport: all three heroes with Pug, six enemies and repeated
  skills; document scrollWidth and innerWidth both 390. No horizontal overflow.
- Observed foreground desktop FPS was approximately 210–280 on this machine.
  The narrow viewport check is not a physical-phone performance measurement.
- `npm test`, `npm run typecheck`, and `npm run build` passed. Production build
  retains Vite's existing large-chunk warning. No new art or runtime dependencies.

## Changed files

- `game/stageRun.ts`: landed-hit presentation metadata.
- `game/hitFeedback.ts`: pure impact/hold/recoil policy.
- `phaser/CombatJuice.ts`: bounded shared feedback lifecycle.
- `phaser/GrindScene.ts`: shared feedback integration and preserved death animation.
- `phaser/PetActor.ts`: local attack-frame lunge.
- `tests/combatJuice.mjs`, `tests/combatSkills.mjs`, `package.json`: verification.
- `scripts/package-shared-art.py`: reproducible quota-compatible release archive.
- This document and `docs/feature-history/README.md`: feature history.

Game/phaser paths above are relative to `src/modules/idle-rpg/`.
