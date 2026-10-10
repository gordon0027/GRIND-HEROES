# Real GH payout path — 2026-10-09 investigation

Title `98JRCAKG`. This is a read-only feasibility record and deployment design,
not an authorization to change funding, publish code, or transfer tokens.

## Current invariant

The protected Team Power Top 100, 10% daily remaining-budget rule, three UTC
windows, and seven historical `inFlight` claims (1,229 GH) remain in place.
PROD CloudCode revision 13 blocks new `claimPowerRewards` reservations. Its
single 1 GH `CryptoCurrency Main` probe returned `Success:false` with
`Server-issued grants of crypto 'Main' are disabled for this title.` The probe
is permanently locked; never reuse it. Live client remains v60; v61 is staged.

## Native iDos candidates

| Mechanism | Real `Main` support evidence | Funding and Power fit | Current Title / conclusion |
| --- | --- | --- | --- |
| CloudCode `ApplyResourceOperation` | Actual PROD request was rejected with `Server-issued grants of crypto 'Main' are disabled for this title.` | No real GH was granted. The rejection does not disclose whether an account-level permission or available backing caused the gate. | Do not repeat this request until iDos identifies the exact gate and confirms the required funding/permission change. |
| Reward daily, idle, comeback, generic claim | Official `reward-system` and `currency-system` registry skills use `ResourceGrant`, whose entry type includes `CryptoCurrency`. This is schema support, not proof that a `Main` claim pays real GH on this Title. | Rewards are static config grants. A generic claim's gate/limits cannot read the protected per-player Power share. Unbacked rewards may become `Main_IOU`. | Active config has GOLD accrual and item claims, no `Main` reward. Native real payout and plan entitlement unverified; cannot implement the required dynamic distribution directly. |
| Quest | Official `quest-system` skill permits server-only objective progress via `server.AddQuestProgress`; native claim uses a static `ResourceGrant`. | Server can authenticate eligibility, but the reward amount is fixed in global config, not each player's frozen Power share. | Active quests grant GEMS only. `Main` outcome and plan entitlement unverified; no direct exact-formula payout. |
| Native leaderboard | Official `leaderboard-system` skill defines fixed `RankRewards` ranges and `ResourceGrant`. | Native rank is verified by its own board. The active protected Team Power Top 100 is a different store; the available CloudCode API has no documented secure score-write/import into a native leaderboard. Fixed rank prizes also differ from Power-proportional amounts. | `Leaderboard` config is empty. `Main` outcome and plan entitlement unverified; not a secure replacement for current calculation. |
| Publisher mail | Official `mailbox-system` skill explicitly says `CRYPTO_FORBIDDEN` for letters and transfers. | Cannot pay `Main`. | Ruled out. |
| Community Marketing | Official skill documents an approved crypto reward paid directly from that programme's pool to a wallet. | This is for approved creator work, not Power rewards. It does not credit in-game `Main`. | No programme configured. Not a legitimate fit for Team Power. |

`Currency.CryptoRewardsFromDeveloperShare` means **top up an unbacked native
crypto reward from the developer share**. The official `currency-system`
reference says that with it off, the unbacked part is granted as an IOU;
`CryptoIouForScriptsAndAI` controls whether script/AI rewards also take that
fallback instead of refusing. Both are false on PROD. This flag is a funding
rule, not proof of CloudCode permission or a guarantee that native rewards
will pay real `Main`. Do not turn it on until iDos confirms the exact pool,
balance accounting, limits, and plan gate. `Main_IOU` is not an acceptable GH
payout.

On 2026-10-09, an iDos developer told the publisher that game-token credits
should work when backed by either the players' reward pool or the developer
pool; using the developer pool requires a setting. Unbacked receipts live in
a separate virtual-currency balance. This is a useful platform statement,
but does not resolve the contradictory PROD CloudCode response above.

The authenticated PROD currency editor is more specific: native leaderboard,
event, quest and store crypto rewards draw from the player reward pool; with
`CryptoRewardsFromDeveloperShare` on, a shortage can draw from the developer
share; with it off, a shortage produces an IOU. The separate
`CryptoIouForScriptsAndAI` switch says CloudCode/AI grants reject on a
shortage when it is off. Both switches are currently off. The public Title
page displays approximately 46.52K GH in the players' pool and 160 GH in the
developer pool. Its tooltip calls these *withdrawal-paying* balances. It does
not state how much of either is uncommitted backing available for **new**
rewards, so 46.52K must not be treated as a spendable grant allowance.

### Native in-game Main pilot (first priority)

The narrowest alternative to the blocked server-issued grant is a **native
Quest claim**: append a permanent one-time quest with a `ServerApi` objective
using a unique metric, and a static `ResourceGrant` of exactly one
`CryptoCurrency Main`. CloudCode would authenticate the fixed publisher test
UserID, keep an independent one-time lock, and call
`server.AddQuestProgress` for that objective only. The authenticated test
player would manually call `client.quest.claimQuestReward`; the native Quest
service, not `ApplyResourceOperation`, would perform the grant. The quest's
claimed state is an additional one-time barrier. This is a **proposed test**,
not a verified working payout: official Quest schema accepts a crypto
`ResourceGrant`, but neither the MCP nor docs establish that this Title's
funding and crypto policy will grant real `Main` rather than reject or issue
`Main_IOU`.

`server.AddQuestProgress` itself is already used by the live stage-completion
handler for the existing `stage_cleared` server-only GEMS quest. That proves
the progress method is wired into this game; it does not prove a native
crypto quest claim can debit the player reward pool.

Before this pilot, obtain an authoritative reading of **unallocated**
player-pool backing, confirm that native Quest `Main` rewards use it for
this Title, and resolve the binding's `Decimals:0` versus mint's 6 on-chain
decimals with iDos. Preserve the seven Power reservations and use a new
quest/probe key. Immediately before the single claim read both `Main` and
`Main_IOU`; after the claim, allow balance propagation and inspect native
transaction/pool debit evidence. Success means `Main +1`, `Main_IOU +0`,
and confirmed backing debit. A successful quest claim with an IOU is a failed
real-GH test. Do not issue another claim on an ambiguous result.

If that pilot succeeds, a Power-proportional payout still needs a dynamic,
server-authoritative native route. The Quest `Grant` amount is globally
static. A bounded denomination scheme (server-only quests for powers of two,
one set per 8-hour cycle) could represent any integer share within the
current daily cap, but would require explicit per-component ledger state and
partial-success reconciliation; it is not safe to turn on merely because the
1 GH quest works. A platform-supported dynamic reward endpoint would be
preferable. Ask iDos for that endpoint and its idempotency key semantics.

The title MCP exposes no read-only per-claim crypto funding verdict, native
test grant result, or subscription/plan entitlement for these pathways. A
configured `ResourceGrant` shape alone cannot establish real payout support.

## Independent Solana GH route

The active iDos `Main` Solana binding names mint
`2gzmu2aJtyw35ph7wQhQKTKe9G6rwD91HyjjsEcJidos`. Two read-only finalized
Solana mainnet RPC calls (`getAccountInfo` and `getTokenSupply`) found an
initialized legacy SPL Token mint under
`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`, **6 on-chain decimals**,
supply `1000000000000000` base units / `1000000000` whole tokens, and no mint
authority. A treasury must therefore already own GH; a payout transfers
existing tokens and cannot mint them. One whole GH is **1,000,000 base units**.
The read-only `node scripts/check-gh-solana-mint.mjs` preflight repeats both
finalized RPC checks; `tests/ghSolanaMint.mjs` covers correct and mismatched
decimals/program owners.

Important discrepancy: `Currency.CryptoCurrencies.Main.Networks[solana].Decimals`
currently says **0**, while the finalized mint says **6**. `DisplayDecimals:0`
is only UI rounding; the network binding's `Decimals` is documented as
on-chain precision. Resolve this discrepancy with iDos before any external
transfer or any assumption about deposit/withdrawal conversion. The external
signer must read and verify the mint's 6 decimals directly from chain and use
`TransferChecked` with integer base units.

An external treasury payout is **real GH in the player's Solana wallet**. It
does not increase `InventoryV2.CryptoCurrencies.Main` in iDos. Depositing
wallet GH into iDos is a separate platform action. The Earnings screen must
show wallet payout status and transaction signature separately from in-game
`Main` balance.

### Minimal production architecture

1. Obtain a dedicated publisher-controlled Solana treasury address holding GH
   and enough SOL for fees/recipient token accounts. Keep its signing key in a
   KMS/HSM or managed custody service, never in the browser, repository, or
   CloudCode. Read its token-account balance before starting.
2. Establish a **signature-verified** Solana wallet binding for each iDos
   `context.UserID`. Prefer the platform's linked-wallet state only after a
   read-only CloudCode check confirms it exposes `LinkedWallets.solana` and
   `IsSignatureVerified`. Never accept an address sent in a claim request.
   If this server-side state is unavailable, use a dedicated wallet-signature
   challenge bound to a single authenticated iDos UserID and expiring nonce.
3. Change only **future** claims: CloudCode computes the existing Power share,
   validates the 8-hour window and cooldown, and CAS-reserves a new claim with
   immutable `claimId`, user, day, window, GH units, mint, verified wallet,
   `solanaBaseUnits`, and `payoutMethod:"external_spl"`. Preserve the seven old
   reservations as unknown; never forward them to this backend automatically.
4. CloudCode calls one allowlisted HTTPS payout backend through
   `server.HttpRequest`, authenticating with a platform-substituted secret.
   The backend accepts only that server credential, not browser traffic. It
   transactionally inserts a unique `(titleId, claimId)` intent and rejects
   reuse with different recipient/amount. A duplicate exact request returns
   the **same** intent and never starts another transfer.
5. The backend verifies mint/decimals and treasury balance, derives the
   recipient's associated token account, persists the signed transaction and
   signature, then submits one `TransferChecked` for the exact base units.
   The backend stores request, signature, destination, amount and state in a
   durable database. Uncertain submission stays `unknown`; it is reconciled
   by signature/transaction lookup before any further action. No automatic
   fresh signing on timeout.
6. On finalized chain success, independently verify the transaction's mint,
   source, destination and amount, then CAS-finalize the matching protected
   claim as wallet-paid. On explicit failure, use the reserved amount-source
   metadata for a reviewed CAS rollback. Missing or ambiguous evidence keeps
   the reservation blocked. The backend is the sole signer; client polling is
   read-only.

The official iDos CloudCode skill documents `server.HttpRequest`, HTTPS host
allowlists and `{{secret:NAME}}` substitution. Currently
`list_title_secrets` reports **no secret** and `OutboundHttp.Enabled:false`
with an empty allowed-host list. No payout backend, treasury address or
verified player-wallet binding has been provided. Thus this architecture is
technically supported by Solana, but not deployable for this Title yet.

The iDos blockchain skill says direct wallet actions inside the
`idosgames.com` game iframe are refused; the site's wallet card handles them.
The proposed payout transfer occurs server-side, so the game does not sign or
connect to a wallet in the iframe. Wallet binding should use the platform's
verified link; any separate top-level linking page needs platform approval and
its own authentication design. The browser must not call the payout backend.

### Single controlled test after prerequisites are met

1. Verify on-chain mint owner/decimals, treasury GH/SOL balances, the fixed
   test UserID's signed wallet binding, backend host and secret, and current
   protected ledger. Confirm the seven old claims are unchanged.
2. Deploy a fixed-account, **new** one-time 1 GH external payout probe with an
   independent permanent lock and new claim ID. Do not reuse the rejected
   CloudCode probe key or touch historical Power reservations.
3. Read the recipient's wallet GH token-account balance immediately before
   the attempt. Send exactly one backend intent. If the response is uncertain,
   inspect the same intent/signature; never create a second transfer.
4. Require finalized Solana transaction evidence and a recipient balance
   increase of exactly 1,000,000 base units. Record the signature, fee and
   backend intent. Confirm the in-game `Main` balance is reported separately.
5. Only after reconciliation and security review, turn on manual **new** Power
   claims. Leave all seven historical reservations blocked until their
   individual platform outcomes are independently established.

### Platform questions that block a native decision

- Can Reward/Quest/Leaderboard native `ResourceGrant` pay **real**
  `CryptoCurrency Main` for Title `98JRCAKG` despite the CloudCode gate? Which
  title/plan permission and which pool are used, and what is the real-vs-IOU
  result when that pool is short?
- Is there a supported server-authoritative API for a **per-user dynamic**
  native `Main` reward calculated from protected CloudCode state, or a safe
  bridge from protected Team Power Top 100 into native leaderboard scoring?
- What exactly does enabling `CryptoRewardsFromDeveloperShare` debit, and what
  caps or permissions apply? Can it ever pay from the players' reward pool?
- How much **uncommitted** GH is available for new `Main` rewards in the
  players' pool, separate from GH already backing existing player balances?
  Does the public 46.52K GH players' withdrawal pool contain this allowance?
- Which precise permission or balance predicate produced
  `Server-issued grants of crypto 'Main' are disabled for this title.` for a
  1 GH CloudCode grant while `AllowedGrantTypes` included CryptoCurrency?
  Would a native `ServerApi` Quest reward be allowed on this Title?
- Why does the Title's Solana `Main` binding say `Decimals:0` while the mint's
  finalized account and `getTokenSupply` report 6?
- Can iDos expose the execution/transaction records for the seven historical
  claim IDs so each can be reconciled without a repeat payout?

Primary Solana references: [TransferChecked](https://solana.com/docs/tokens/basics/transfer-tokens),
[mint and token-account model](https://solana.com/docs/tokens),
[RPC methods](https://solana.com/docs/rpc/http),
[production signing](https://solana.com/docs/core/transactions/signing-in-production),
[transaction lookup](https://solana.com/docs/rpc/http/gettransaction).
