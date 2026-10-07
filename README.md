# Grind Heroes

Pixel-art idle RPG built with React, Phaser and the iDos Games SDK. The game has
three acts and 30 finite stages, a party of up to three heroes, melee and ranged
combat, equipment, bosses, and a stage map. Progress and rewards are validated
by the DEV Title. Stage clears grant GOLD and unopened chests; players open one
chest at a time through iDos Lootbox. See
[feature history](docs/feature-history/README.md) for implementation details.

Sign-in uses the iDos guest, e-mail and available platform providers. This Title
currently runs as Web2; wallet sign-in is not wired into the app.

## Setup

1. The canonical Grind Heroes Title ID is `98JRCAKG` in `src/idos.title.ts`.
2. Local development uses `VITE_IDOS_ENV=dev` in `.env.local`; the baked default
   is also DEV. This resolves the runtime Title to `98JRCAKG-DEV` on localhost.
3. Run `npm install`, then `npm run dev`.

No credentials belong in the repository. The runtime uses the real iDos backend.

## Verification

Run `npm run typecheck`, `npm run build` and `npm run test`. Runtime testing must authenticate
against the DEV Title, then inspect the current player's server-backed state.
