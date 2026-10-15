import { earningsStatus, ghAmount, utcTime, type EarningsOverview } from "./earningsModel";

export function EarningsView({data,updated,stale}: {data:EarningsOverview;updated:string|null;stale:boolean}) {
  return <>
    <div className="gh-earnings-pool"><img src="https://cloud.idosgames.com/drive/img/98JRCAKG/hard-token.png" alt="GH token" />
      <div><small>REMAINING REWARD BUDGET</small><strong>{ghAmount(data.budgetRemainingUnits)}</strong>
        <span>Live pool balance unavailable</span></div></div>
    <p className="gh-earnings-caption">Game accounting budget, separate from the platform's live GH reserve and your wallet.</p>
    <section className="gh-earnings-group" aria-label="Today's allocation"><h3>Today's allocation</h3>
      <div className="gh-earnings-dialog__grid">
        <div><span>Today's GH Budget</span><strong>{ghAmount(data.dailyBudgetUnits)}</strong></div>
        <div><span>Participants</span><strong>{data.participantCount?.toLocaleString("en-US") ?? "—"}</strong></div>
      </div>
      <p className="gh-earnings-caption">UTC {data.day?.slice(0,10) ?? "date unavailable"} · {data.window === null ? "Window unavailable" : `Window ${data.window} of 3`}</p>
      <p className="gh-earnings-caption">Next window: {utcTime(data.nextWindowAtUtc)}</p>
    </section>
    <section className="gh-earnings-group" aria-label="Your calculated rewards"><h3>Your calculated rewards</h3>
      <div className="gh-earnings-dialog__grid">
        <div><span>Your Rank</span><strong>{data.rank === null ? data.participantCount === null ? "—" : "Unranked" : `#${data.rank}`}</strong></div>
        <div><span>Your Team Power</span><strong>{data.power?.toLocaleString("en-US") ?? "—"}</strong></div>
        <div className="gh-earnings-dialog__available"><span>Today's Calculated GH Share</span><strong>{ghAmount(data.dailyShareUnits)}</strong><small>Accounting allocation</small></div>
        <div><span>Current Window Allocation</span><strong>{ghAmount(data.currentWindowUnits)}</strong><small>Not a confirmed payment</small></div>
      </div>
      {data.inactiveCreditUnits !== null && data.inactiveCreditUnits !== "0" ? <p className="gh-earnings-caption">Saved absence allocation: {ghAmount(data.inactiveCreditUnits)}</p> : null}
    </section>
    <section className="gh-earnings-group" aria-label="Payment status"><h3>Payment status</h3>
      <div className="gh-earnings-dialog__grid">
        <div><span>Confirmed Lifetime GH Received</span><strong>{ghAmount(data.paidTotalUnits)}</strong></div>
        <div><span>Pending Review</span><strong>{ghAmount(data.pendingReviewUnits)}</strong><small>Unconfirmed reserved amount</small></div>
      </div>
      <p className="gh-earnings-dialog__notice">{earningsStatus(data)}</p>
    </section>
    <details className="gh-earnings-dialog__details"><summary>How Rewards Work</summary>
      <p>At the daily UTC snapshot, the 10% accounting budget is shared by Team Power among eligible Top 100 players. Daily shares are split into three eight-hour windows.</p>
      <p>Missed windows expire; one absence allocation may be saved. An eight-hour cooldown applies. Calculated shares and amounts pending review are not proof of a transfer.</p>
      <p>Only confirmed lifetime receipts represent payments recorded in the reward ledger. GH payouts are currently unavailable; no GH can be claimed here.</p>
    </details>
    <p className="gh-earnings-caption">{stale ? "Showing previous data · " : ""}Last updated: {utcTime(data.updatedAtUtc ?? updated)}</p>
  </>;
}
