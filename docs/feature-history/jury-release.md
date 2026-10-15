# Jury Edition production release — 2026-10-15

The user explicitly authorized PROD deployment after reviewing the prepared branch.
Build v82 (`bld038f0b8740cb4c379b72311165eb294b`) went Live, replacing v81.
It was superseded by v83's direct Shop header button; see [Shop](shop.md).
Source commit: `bf2b94b2393c8e00bd25df44bdac99929c98b524`, branch
`codex/grind-heroes-update`; the replacement GitHub PR #2 remains open and main was not merged.

The build uses `VITE_IDOS_ENV=prod` and a relative Vite base. All original artwork
is included in the self-contained 119-file archive; no older build asset paths
or external wrapper were used. All 119 hosted resources returned HTTP 200.
The live root serves `index-C0YsBddY.js` and `index-B9lJOQ4_.css`.

An existing PROD session loaded automatic combat, Inventory and Hero Progression
with milestones 5/8/10. The public iDos app's PLAY NOW rendered the game's login
screen in its iframe. No new iframe authentication or full gameplay test was
performed. One existing SDK `Too soon` retry warning occurred during navigation.
The ordinary native AFK popup claimed its reward on dismissal. No purchases,
hero upgrades, GH claims/transfers or payout probes were submitted.

No CloudCode, Title configuration, progression data, financial gates or contracts
were saved by this release. Deploying the frontend does not enable GH payouts.

Evidence: [release record](../../artifacts/jury-edition/prod-release.json),
[CDN audit](../../artifacts/jury-edition/prod-cdn-audit.json),
[live dialog](../../artifacts/jury-edition/prod/live-progression.png),
[iframe login](../../artifacts/jury-edition/prod/idos-iframe-login.png).
