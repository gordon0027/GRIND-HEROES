import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIDosGamesClient } from "@idosgames/react";

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

const number = (value: string | number | null) => value == null ? "—" :
  Number(value).toLocaleString("en-US");

function claimStatus(data: EarningsOverview): string {
  if (data.status === "review_required") return "Payout needs review. No new claim will be attempted.";
  if (data.status === "disabled") return "GH rewards are currently paused.";
  if (data.status === "empty_leaderboard") return "No eligible players in today's snapshot.";
  if (data.status === "insufficient_budget") return "The budget is too small for today's payouts.";
  if (data.status === "not_started") return "Today's reward snapshot is not ready yet.";
  if (data.status === "cooldown") return `Next claim after ${new Date(data.cooldownUntilUtc!).toLocaleString()}.`;
  if (data.status === "available") return "This window can be claimed on your next game check.";
  if (data.claimedWindow) return "This window has already been claimed.";
  return "No GH is due in this window.";
}

export function Earnings(): React.ReactNode {
  const client = useIDosGamesClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<EarningsOverview | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await client.cloudCode.execute("getPowerRewardOverview", {});
      if (!result.ok) throw new Error(String(result.error ?? result.reason));
      if (result.data.Error) throw new Error(String(result.data.Error.Message ?? result.data.Error.Error));
      const overview = result.data.FunctionResult as EarningsOverview | null;
      if (!overview || typeof overview.status !== "string" || typeof overview.dailyShareUnits !== "string")
        throw new Error("Invalid earnings response");
      setData(overview);
    } catch {
      setError("Could not load earnings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [client]);

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
        {data && <>
          <p className="gh-earnings-dialog__day">UTC day {data.day} · Window {data.window} of 3</p>
          <div className="gh-earnings-dialog__grid">
    <div><span>Unreserved reward budget</span><strong>{number(data.budgetRemainingUnits)} GH</strong></div>
            <div><span>Today's maximum</span><strong>{number(data.dailyBudgetUnits)} GH</strong></div>
            <div><span>Your Power rank</span><strong>{data.rank ? `#${data.rank}` : "Outside Top 100"}</strong><small>{number(data.power)} Power</small></div>
            <div><span>Your share today</span><strong>{number(data.dailyShareUnits)} GH</strong><small>Power weighted at daily snapshot</small></div>
            <div><span>Current 8h window</span><strong>{number(data.currentWindowUnits)} GH</strong></div>
            <div><span>Paid to you so far</span><strong>{number(data.paidTotalUnits)} GH</strong></div>
          </div>
          {data.inactiveCreditUnits !== "0" && <p className="gh-earnings-dialog__credit">Saved absence credit: {number(data.inactiveCreditUnits)} GH</p>}
          {data.pendingReviewUnits !== "0" && <p className="gh-earnings-dialog__credit">Reserved, not confirmed: {number(data.pendingReviewUnits)} GH</p>}
          <p className={`gh-earnings-dialog__notice${data.status === "review_required" ? " gh-earnings-dialog__notice--review" : ""}`}>{claimStatus(data)}</p>
          <p className="gh-earnings-dialog__fineprint">Budget is tracked by the game from the entered 40,000 GH starting balance. Reserved claims are excluded; this is not a live platform pool balance. Today's share is a maximum. The paid total counts only grants confirmed by the game ledger. Rank can change during the day; the share is fixed at the UTC snapshot.</p>
        </>}
        <button type="button" className="gh-earnings-dialog__refresh" onClick={() => void refresh()} disabled={loading}>Refresh</button>
      </section>
    </div>, document.body)}
  </>;
}
