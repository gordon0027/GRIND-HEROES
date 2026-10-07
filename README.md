# Grind Heroes

Phaser/TypeScript game built from the official iDos Games host scaffold and
`idle-rpg` module. Five finite stages use one three-slot party runtime with
blocking encounters, bosses, clear/fail states and Retry. The DEV Title provides
six equipment slots per hero, saved stage unlocks and secure run rewards.
Character ownership, formation, equipment, inventory, currencies and stage
progress are read from iDos. Validated clears grant GOLD and a server-random
gear chest; the first Stage 1 clear adds Traveler Boots. See
[feature history](docs/feature-history/README.md) for details.

This foundation uses the regular iDos sign-in flow (guest, e-mail and available
platform providers). Wallet sign-in is not wired into the app: the wallet stack
shipped in the host scaffold currently fails the Vite build because its `wagmi`
package imports a `viem/tempo/zones` export that the installed `viem` does not
provide. Keep the new Title open/Web2 for this first slice. Wallet source remains
in the scaffold for a later compatible Web3 setup.

## Setup

1. The canonical Grind Heroes Title ID is `98JRCAKG` in `src/idos.title.ts`.
2. Local development uses `VITE_IDOS_ENV=dev` in `.env.local`; the baked default
   is also DEV. This resolves the runtime Title to `98JRCAKG-DEV` on localhost.
3. Run `npm install`, then `npm run dev`.

No credentials belong in the repository. The runtime uses the real iDos backend.

## Verification

Run `npm run typecheck`, `npm run build` and `npm run test`. Runtime testing must authenticate
against the DEV Title, then inspect the current player's server-backed state.
