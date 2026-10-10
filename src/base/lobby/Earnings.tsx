import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { waitForAuthoritativeGh, wholeGh } from "./ghBalance";

interface EarningsOverview {
  day: string;
  status: string;
  budgetRemainingUnits: string | null;
  dailyBudgetUnits: string;
  participantCount: number;
  rank: number | null;
  power: number;
  dailyShareUnits: string;
  currentWindowUnits: string;
  inactiveCreditUnits: string;
  pendingReviewUnits: string;
  paidTotalUnits: string;
  claimedWindow: boolean;
  cooldownUntilUtc: string | null;
  window: number;
  nextWindowAtUtc: string;
}

interface ProbeStatus { authorized: boolean; locked?: boolean; grantApiAvailable?: boolean; state?: string }
interface ProbeResult { status: string; request?: unknown; response?: unknown; error?: unknown; auditStored?: boolean }

// The client stays closed until the one-GH PROD receipt and authoritative
// inventory delta have been checked. The CloudCode handler has its own gate.
const GH_REAL_PAYOUT_VERIFIED = false;
const number = (value: string | number | null) => value == null ? "—" :
  Number(value).toLocaleString("en-US");
const available = (data: EarningsOverview): bigint | null => {
  const window = wholeGh(data.currentWindowUnits);
  const saved = wholeGh(data.inactiveCreditUnits);
  return window === null || saved === null ? null : window + saved;
};

function claimStatus(data: EarningsOverview): string {
  if (data.status === "review_required") return "A reserved GH payout needs review. Claiming is locked for this account.";
  if (data.status === "disabled") return "GH rewards are paused.";
  if (data.status === "empty_leaderboard") return "No eligible players in today's snapshot.";
  if (data.status === "insufficient_budget") return "Today's reward budget is too small.";
  if (data.status === "not_started") return "Today's reward snapshot is not ready yet.";
  if (data.status === "cooldown") return `Next claim after ${new Date(data.cooldownUntilUtc!).toLocaleString()}.`;
  if (data.status === "available" && !GH_REAL_PAYOUT_VERIFIED)
    return "Claims will open after the real-GH payout test is verified.";
  if (data.status === "available") return "Your GH is ready to claim.";
  if (data.claimedWindow) return "This window has already been claimed.";
  return "No GH is due in this window.";
}

export function Earnings(): React.ReactNode {
  const client = useIDosGamesClient();
  const user = useUserState();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<EarningsOverview | null>(null);
  const [probe, setProbe] = useState<ProbeStatus | null>(null);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [claimBlocked, setClaimBlocked] = useState(false);
  const pending = useRef(false);
  const balance = wholeGh(user?.InventoryV2?.CryptoCurrencies?.Main?.Amount);

  const execute = useCallback(async (handler: string): Promise<unknown> => {
    const result = await client.cloudCode.execute(handler, {});
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    if (result.data.Error) throw new Error(String(result.data.Error.Message ?? result.data.Error.Error));
    return result.data.FunctionResult;
  }, [client]);

  const readBalance = useCallback(async (): Promise<bigint> => {
    const result = await client.user.getUserInventory();
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    const amount = wholeGh(client.data.user.state?.InventoryV2?.CryptoCurrencies?.Main?.Amount);
    if (amount === null) throw new Error("Main GH inventory is unavailable");
    return amount;
  }, [client]);

  const waitForBalance = useCallback((expected: bigint) =>
    waitForAuthoritativeGh(expected, readBalance), [readBalance]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const overview = await execute("getPowerRewardOverview") as EarningsOverview | null;
      if (!overview || typeof overview.status !== "string" || typeof overview.dailyShareUnits !== "string")
        throw new Error("Invalid earnings response");
      setData(overview);
      if (overview.status !== "review_required") setClaimBlocked(false);
    } catch (cause) {
      setError(`Could not load earnings: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    setLoading(false);
    if (new URLSearchParams(window.location.search).get("ghProbe") !== "1") return;
    setProbeLoading(true);
    // The title may rate-limit separate CloudCode handlers shortly after the
    // overview. The probe is read-only and queried only on the staging link.
    for (let attempt = 0; attempt < 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 3100 : 5000));
      try {
        const status = await execute("getOneGhPayoutProbeStatus") as ProbeStatus | null;
        setProbe(status?.authorized ? status : null);
        break;
      } catch { if (attempt === 1) setProbe(null); }
    }
    setProbeLoading(false);
  }, [execute]);

  const claim = useCallback(async () => {
    if (pending.current || !GH_REAL_PAYOUT_VERIFIED || data?.status !== "available") return;
    const amount = available(data);
    if (amount === null || amount <= 0n) return;
    pending.current = true;
    setClaimBlocked(true);
    setBusy(true);
    setError("");
    setMessage("");
    setSuccess("");
    try {
      const before = await readBalance();
      const result = await execute("claimPowerRewards") as { status?: string; amountUnits?: string } | null;
      if (result?.status === "granted") {
        const granted = wholeGh(result.amountUnits);
        if (granted !== amount) {
          setError("The server reported a payout with an unexpected amount. Check the actual balance; do not retry.");
        } else if (await waitForBalance(before + amount)) setSuccess(`+${number(result.amountUnits!)} GH`);
        else setMessage("The server confirmed the payout, but the GH balance has not refreshed yet. Check your balance before contacting support.");
      } else if (result?.status === "in_flight" || result?.status === "grant_rejected_review_required")
        setError("This payout is reserved for review. Do not retry it.");
      else setMessage("No GH was confirmed. Refresh earnings for the current claim status.");
      const overview = await execute("getPowerRewardOverview") as EarningsOverview;
      if (overview?.status) { setData(overview); if (overview.status !== "review_required") setClaimBlocked(false); }
    } catch (cause) {
      setError(`Payout outcome is uncertain: ${cause instanceof Error ? cause.message : String(cause)}. Check earnings before any new claim.`);
      try { const overview = await execute("getPowerRewardOverview") as EarningsOverview;
        if (overview?.status) setData(overview); } catch { /* Preserve the uncertainty. */ }
    } finally { pending.current = false; setBusy(false); }
  }, [data, execute, readBalance, waitForBalance]);

  const runProbe = useCallback(async () => {
    if (pending.current || !probe?.authorized || probe.locked) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setProbeResult(null);
    let grantRequested = false;
    try {
      const before = await readBalance();
      grantRequested = true;
      const result = await execute("runOneGhPayoutProbe") as ProbeResult;
      setProbeResult(result);
      if (result.status === "unsupported_api") {
        setProbe({ authorized: true, locked: false, grantApiAvailable: false, state: result.status });
        setError("The iDos CloudCode runtime does not expose ApplyResourceOperation. No GH grant was attempted.");
        return;
      }
      setProbe({ authorized: true, locked: true, state: result.status });
      if (result.status !== "platform_accepted") {
        setError("The one-GH platform result was rejected or is uncertain. The probe is locked. Do not retry.");
      } else if (await waitForBalance(before + 1n)) {
        setSuccess("+1 GH verified in your Main balance");
      } else {
        setError("The platform accepted the request, but the Main balance did not show +1 GH. The probe remains locked.");
      }
    } catch (cause) {
      if (grantRequested) setProbe({ authorized: true, locked: true, state: "unknown" });
      setError(grantRequested
        ? `One-GH test outcome is uncertain: ${cause instanceof Error ? cause.message : String(cause)}. Do not retry.`
        : `Could not read your GH balance before the test: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { pending.current = false; setBusy(false); }
  }, [probe, execute, readBalance, waitForBalance]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return <>
    <button type="button" className="grind-frame-header__earnings" onClick={() => {
      setOpen(true);
      void refresh();
    }} aria-label="Open GH earnings" aria-haspopup="dialog">
      <span aria-hidden="true">◈</span><span>EARNINGS</span>
    </button>
    {open && createPortal(<div className="gh-earnings-overlay" onClick={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className="gh-earnings-dialog" role="dialog" aria-modal="true" aria-labelledby="gh-earnings-title">
        <header className="gh-earnings-dialog__header">
          <div><small>GRIND HEROES / POWER REWARDS</small><h2 id="gh-earnings-title">GH Earnings</h2></div>
          <button type="button" aria-label="Close earnings" onClick={() => setOpen(false)}>×</button>
        </header>
        {loading && !data && <p className="gh-earnings-dialog__notice">Loading earnings…</p>}
        {error && <p className="gh-earnings-dialog__error" role="alert">{error}</p>}
        {message && <p className="gh-earnings-dialog__notice" role="status">{message}</p>}
        {success && <p className="gh-earnings-dialog__success" role="status" key={success}>{success}</p>}
        {data && <>
          <p className="gh-earnings-dialog__day">UTC {data.day} · Window {data.window} of 3</p>
          <div className="gh-earnings-dialog__grid">
            <div><span>GH Balance</span><strong>{balance === null ? "—" : number(balance.toString())} GH</strong></div>
            <div><span>Your Power</span><strong>{number(data.power)}</strong></div>
            <div><span>Leaderboard Rank</span><strong>{data.rank ? `#${data.rank}` : "Outside Top 100"}</strong></div>
            <div><span>Today's GH reward</span><strong>{number(data.dailyShareUnits)} GH</strong></div>
            <div className="gh-earnings-dialog__available"><span>Available to claim</span><strong>{data.status === "available" ? number(available(data)?.toString() ?? null) : "0"} GH</strong></div>
            <div><span>Confirmed lifetime earnings</span><strong>{number(data.paidTotalUnits)} GH</strong></div>
          </div>
          <button type="button" className="gh-earnings-dialog__claim" onClick={() => void claim()}
            disabled={busy || loading || claimBlocked || !GH_REAL_PAYOUT_VERIFIED || data.status !== "available" ||
              (available(data) ?? 0n) <= 0n}>CLAIM GH</button>
          <p className={`gh-earnings-dialog__notice${data.status === "review_required" ? " gh-earnings-dialog__notice--review" : ""}`}>{claimStatus(data)}</p>
          {data.pendingReviewUnits !== "0" && <p className="gh-earnings-dialog__credit">Reserved for review: {number(data.pendingReviewUnits)} GH</p>}
          <details className="gh-earnings-dialog__details"><summary>How GH rewards work</summary>
            <p>The 10% daily GH budget is split by Power among the Top 100 at the UTC snapshot, then across three eight-hour windows. Missed windows expire; one absence credit may be saved. An eight-hour cooldown applies.</p>
            <p>Unreserved manual budget: {number(data.budgetRemainingUnits)} GH. Today's maximum: {number(data.dailyBudgetUnits)} GH. These are game accounting values, not a live platform pool balance.</p>
          </details>
        </>}
        {probeLoading && <p className="gh-earnings-dialog__notice">Checking publisher test access…</p>}
        {!probeLoading && !probe && new URLSearchParams(window.location.search).get("ghProbe") === "1" &&
          <p className="gh-earnings-dialog__notice">Publisher test is unavailable for this account or revision.</p>}
        {probe?.authorized && <section className="gh-earnings-dialog__probe">
          <h3>Publisher 1 GH payout test</h3>
          <p>This action attempts exactly one Main GH grant to this authenticated test account. It stays locked after any outcome.</p>
          <button type="button" onClick={() => void runProbe()} disabled={busy || probe.locked || probe.grantApiAvailable === false}>RUN ONE-TIME 1 GH TEST</button>
          {probe.grantApiAvailable === false && <p>The CloudCode grant API is unavailable in this runtime. No grant can be attempted.</p>}
          {probe.locked && <p>Probe locked · {probe.state ?? "unknown"}</p>}
          {probeResult && <details><summary>Platform response</summary><pre>{JSON.stringify(probeResult, null, 2)}</pre></details>}
        </section>}
        <button type="button" className="gh-earnings-dialog__refresh" onClick={() => void refresh()} disabled={loading || busy}>Refresh</button>
      </section>
    </div>, document.body)}
  </>;
}
