# GH holder Watchdog: feasibility check (2026-10-20)

## Current decision (2026-10-20)

The owner cancelled holder access and requested an ordinary GH pet purchase plus
a simple Phantom connection without balance checks or signatures. Watchdog now
uses the existing `pet_gh_v1` catalog entry, portrait, animation and server-owned
selection. PROD has its nontradable stackable Item and a fixed `shop/pets/slot_pet_gh_v1`
offer: consume exactly 1 in-game `CryptoCurrency:Main`, grant exactly one Item,
`TotalCap:1`. Existing Donkey/Pug offers and all other store entries were preserved.
This does not spend from the connected Phantom wallet.

The new header WALLET entry opens TEAM/PETS. `PhantomPanel` only calls provider
connect/disconnect, displays the address and handles account switches, rejection,
trusted reconnect and cleanup. It neither signs nor reads holdings nor replaces
the authenticated iDos player. A missing iframe provider shows an explicit link
to open the standalone game using the player's usual account. No native wallet
package is imported: its lazy Solana entry also bundled incompatible EVM deps.

All gameplay tests, typecheck and build passed. A fresh zero-GH PROD test guest
resolved the exact Watchdog offer and slot, received the native insufficient-GH
rejection and could not equip an unowned Watchdog. No real player's tokens were
spent. Successful funded purchase and actual Phantom connection remain for the
owner's browser test: browser automation was disabled in Work, and the owner
explicitly authorized publication with manual testing.

During the preceding investigation, native DEV signature linking succeeded with
a generated test Ed25519 key and a replay was rejected. This was not a real Phantom
signing test. Both DEV and PROD CloudCode HTTP probes were refused with
`Outbound HTTP from CloudCode is not available on the current plan.` Enabling the
configuration did not enable the plan feature. All probe handlers were removed;
PROD revision 18 has the identical source hash as the original revision 15,
`27dc67e2f3c84ca2a24b46578aae6f25ece02ff84439c1091cb5a24d39fa80d1`,
with the same 23 handlers and HTTP disabled. DEV revision 37 restores its original
gameplay source. DEV blockchain settings were restored to their original state.
PROD blockchain settings, wallet login and Open gameplay were not changed.

## Original feasibility audit (historical)

Status at the initial audit: stopped at the requested feasibility gate. No wallet or holder UI, entitlement,
pet grant, source change, PROD deployment or GitHub push was made. Tutorial V2 is
already live as v85, from commit `f946b03`; the attachment's pre-release description
was stale. Current PROD CloudCode remains revision 15.

## Verified state

- PROD `Currency.CryptoCurrencies.Main.Networks[solana]` names
  `2gzmu2aJtyw35ph7wQhQKTKe9G6rwD91HyjjsEcJidos` with 6 decimals.
  Real finalized mainnet `getAccountInfo` and `getTokenSupply` reads agreed at slot
  459283947: initialized legacy SPL mint, no mint authority. The holder threshold
  is exactly `1000000000` raw units, compared as an integer.
- A real `getTokenAccountsByOwner`, filtered by this mint, returned zero accounts
  and raw balance `0` for a generated test public key at finalized slot 459285945.
  This was a local Node transport check, NOT a linked Phantom player's balance,
  NOT a CloudCode RPC check and NOT authority to grant a pet.
- The existing Watchdog is `pet_gh_v1`, including its asset key, item ID and offer
  ID in the local and deployed server catalog. `pet_3_watchdog` is not this game's
  current identifier. PROD has Donkey and Pug item definitions and offers, but no
  Watchdog item or purchase offer. Historical paid ownership has not been proven
  absent; a future migration must preserve legitimate ownership if any is found.
- The project pins core 0.21.2 and wallet 0.6.2. The registry currently advertises
  core 0.22.1 and wallet 0.6.5. No dependency upgrade was performed.

## Native iDos link probe

`client.auth.linkWallet(address, "solana")` exists in the installed SDK. A fresh
DEV guest signed in successfully. Before setup it refused the unsigned challenge
request with `Network 'solana' not configured.`

For a temporary DEV-only probe, Solana and WalletLogin were enabled while keeping
PlayAccess `Open`, no token gates and no wallet button on the login screen. The
guest then received `{ Linked, Challenge, ExpiresAt }` without a signature. The
signed text included title ID, address, network, nonce and issued time, followed
by a generic sign-in purpose. It did NOT include origin, signed expiration or an
explicit holder-link purpose. Supplying the game's Origin header did not change
that text. Expiration was a separate response field, five minutes after issuance.

This is a mismatch with the requested challenge contract, not evidence that the
platform's normal wallet authentication is cryptographically broken. No supported
challenge-template/custom-message option or CloudCode Ed25519 verifier was found
in the inspected skills/configuration. Verification of account binding, signature
rejection, nonce consumption, cross-account uniqueness and trusted access to native
`LinkedWallets` from CloudCode is still required before using it for this feature.

The DEV blockchain settings were returned to their original effective state:
empty Networks, WalletLogin disabled, no iframe allowlist, and Open play. A fresh
guest probe again returned `Network 'solana' not configured.`, with the before/after
wallet state unchanged. No signature was submitted or wallet linked during any probe.

## Iframe and server RPC

The iDos Blockchain skill requires the platform wallet bridge inside idosgames.com
and documents `linkWalletViaPlatform`; its direct wallet helpers refuse embedded
wallet actions. Phantom's provider documentation says it is not injected into
iframes. However, a read-only page in the user's actual Chrome profile detected
`isPhantom` both at localhost top level and in a cross-origin 127.0.0.1 iframe.
Do not equate provider presence with a working connection/signature flow or assume
the result applies to all Phantom versions or the actual iDos frame. No real
Phantom connection or signing test was performed because a challenge meeting the
required trusted contract was not established.

Both DEV and PROD `list_title_secrets` report no integration entries and
`OutboundHttp.Enabled:false`, `AllowedHosts:[]`. A trusted CloudCode Solana read
has not been established. A browser or local Node balance must never replace it.
The global PlayAccess token gate would restrict normal gameplay, so it is not a
substitute for an optional Watchdog entitlement.

## Smallest next step

First prefer a platform extension: confirm an origin/purpose/expiry-bound link
challenge for the current account, expose its signature-verified wallet to the
pet handlers, and configure/verify server-side Solana RPC access. Keep Open login.
Then test a real Phantom signature through the platform bridge and implement the
short-lived holder entitlement at pet selection and stage start.

If the native platform cannot provide that contract, a separate verifier needs
prior infrastructure approval: one HTTPS service, a durable nonce/wallet-binding
database with a unique wallet constraint, an authenticated CloudCode-to-service
secret, an allowlisted host and server-side mainnet RPC. A top-level authorization
page can use the injected Phantom provider, with encrypted deep links for mobile;
only an opaque request handle may cross the iframe boundary, never an iDos session
ticket in a URL. The verifier must validate the authenticated account, Ed25519
signature, origin, purpose, expiry and single-use nonce, then aggregate raw GH
balances. It must preserve paid ownership, cache eligibility briefly, fail closed
for new access on RPC errors and revoke holder benefits only at a safe run boundary.

A possible hosting option is Cloudflare Workers + D1: a prototype may fit the free
quotas; Workers Paid starts at USD 5/month plus usage, with RPC billed separately
according to provider/plan. This is an option, not a deployed or approved service.
Public Solana RPC is rate-limited and is not recommended as production infrastructure.
No paid resource, signing key, RPC credential or external backend was created.

## Evidence and outstanding tests

Passed: real DEV guest login, unsigned native challenge availability before/during/
after temporary setup, unchanged wallet-state reads, real mint and zero-account RPC
reads, and `node tests/ghSolanaMint.mjs` (including wrong decimals/program fixtures).
Local screenshot: `.tmp/phantom-provider-feasibility.png`.

Not tested: real Phantom signing, secure completed linking, iDos SSO linking,
invalid/expired/reused signed nonces, holder threshold fixtures, dynamic revocation,
Watchdog entitlement/equipment, new mobile UI, or actual iDos holder integration.
There is no implementation to release. Existing gameplay source was not changed;
typecheck/build/full gameplay tests were therefore not rerun for this documentation audit.

Sources:
- https://docs.phantom.com/solana/detecting-the-provider
- https://docs.phantom.com/solana/signing-a-message
- https://docs.phantom.com/phantom-deeplinks/provider-methods/signmessage
- https://docs.phantom.com/phantom-portal/verify-domain (Phantom Connect production
  verification requirements; these must not be confused with direct injected-provider use)
- https://solana.com/docs/rpc/http/gettokenaccountsbyowner
- https://solana.com/docs/references/clusters
- https://developers.cloudflare.com/workers/platform/pricing/
- iDos registry skills: authentication, blockchain-system, cloud-code.
