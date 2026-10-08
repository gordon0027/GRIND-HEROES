# Grind Heroes login and AFK presentation

## RPG styling pass (2026-10-08)

The login screen retains its existing iDos provider selection, SSO/session
restore, email registration/reset and guest behavior. Its card, fields and
buttons now use the game's dark brown and gold palette and existing RPG button
assets. "Continue with iDos Games" uses the primary brown/gold button with
its iDos mark above the button frame. The status and error messages remain
inside the card. This was a
presentation change; no authentication service calls or session logic changed.

The AFK popup uses the same panel/button language and the existing Grind Gold
asset (`heroUi.gold`). `IdleSession.collect()` still calls the authoritative
`client.reward.collectIdleAccrual()` before showing the popup, then records the
server's `LastClaimedAmount`. The popup's Collect button dismisses and
celebrates that already credited payout; it does not submit a second claim.
The click is guarded against duplicate celebration. The reward formula, cap,
timer and claim operation are unchanged. Non-GOLD currencies retain the
existing `ResourceList` rendering.

Local desktop and 390px viewport checks found no horizontal overflow. The
mobile AFK dialog was 358px wide with a 230px button; the mobile login card
was 358px wide. A local DEV guest login showed its pending/disabled state and
completed successfully. No build was published for this pass while global
Marketplace statistics lack an authoritative server source.
