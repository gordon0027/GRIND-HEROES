# Jury Edition GH Earnings (2026-10-15)

Earnings is a read-only presentation of `getPowerRewardOverview`. The player UI
contains no claim handler or one-GH probe call. The Claim action is permanently
disabled and labelled unavailable. Existing CloudCode payout gates, historical
locks, reward formulas, token contracts and configuration were not modified.

Remaining Reward Budget is the game accounting ledger, never the live platform
pool or player's GH balance. Available Currency SDK and Title MCP readers do not
provide an authorized live shared-pool balance endpoint. The UI states "Live pool
balance unavailable". Daily share and window allocation are accounting figures;
only paidTotalUnits is labelled a confirmed lifetime receipt, and pendingReviewUnits
is always unconfirmed. Sparse fields stay unknown; malformed responses are rejected.
Whole-token strings are formatted through BigInt, with no Number precision loss.

Reads happen on open or manual Refresh. An in-flight gate and five-second request
spacing prevent double requests; there is no polling. Failed refreshes retain
last good data with stale wording. Updated server time is preferred, with clearly
identified fetch-time fallback for older revisions. Normal UI never dumps backend
errors or raw status enums. Native dialog blocks background controls and restores
focus on Escape or Close; its header and footer remain accessible while its body
scrolls.

2026-10-15 read-back: isolated DEV overview transport succeeded but its handler
returned an application error. PROD getPowerRewardOverview succeeded: budget
36,164 GH, daily budget 3,616 GH, 73 participants, window 2. The isolated read-only
account had no allocation or confirmed receipts. Records in artifacts/jury-edition
contain only overview aggregates and the account's zero amounts, no identity or
authentication data. The overview performs its existing daily accounting catch-up;
no grant handler or financial probe was invoked.

Offline visual states are served at /tests/fixtures/earnings-qa.html by Vite. They
are explicitly labelled QA, include the captured PROD read and separate mock
allocation/paused/no participants/not-ready/review/historical/stale states, and
are not an app entrypoint or a production screenshot. Real DEV unavailable/error
and loading behavior is tested in the actual app. Financial transfers are untested
and intentionally unavailable.
