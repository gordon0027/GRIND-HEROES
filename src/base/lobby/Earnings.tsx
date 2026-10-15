import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIDosGamesClient } from "@idosgames/react";
import { parseEarnings, type EarningsOverview } from "./earningsModel";
import { EarningsView } from "./EarningsView";
import "./earnings.css";
import { useDialogFocus } from "../../shared/ui/useDialogFocus";

/** Read-only reward accounting. Claiming stays disabled; no grant or probe action is exposed. */
export function Earnings(): React.ReactNode {
  const client = useIDosGamesClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<EarningsOverview | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [cooling, setCooling] = useState(false);
  const inFlight = useRef(false);
  const lastRequest = useRef(0);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useDialogFocus<HTMLDialogElement>(() => setOpen(false), open);
  useEffect(() => () => { if (cooldownTimer.current) clearTimeout(cooldownTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus({preventScroll:true}); };
  }, [open]);
  const refresh = useCallback(async () => {
    if (inFlight.current || Date.now() - lastRequest.current < 5000) return;
    inFlight.current = true; lastRequest.current = Date.now();
    setLoading(true); setCooling(true); setError("");
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => setCooling(false), 5000);
    try {
      const result = await client.cloudCode.execute("getPowerRewardOverview", {});
      if (!result.ok || result.data.Error) throw new Error("Earnings request unavailable");
      setData(parseEarnings(result.data.FunctionResult));
      setUpdated(new Date().toISOString());
    } catch {
      setError("Earnings could not be refreshed. Please wait a moment and try again.");
    } finally { inFlight.current = false; setLoading(false); }
  }, [client]);
  const stale = !!error || !!updated && Date.now() - Date.parse(updated) > 60000;
  return <>
    <button type="button" className="grind-frame-header__earnings" aria-label="Open GH earnings" aria-haspopup="dialog"
      onClick={() => { setOpen(true); void refresh(); }}><span aria-hidden="true">◈</span><span>EARNINGS</span></button>
    {open ? createPortal(<dialog ref={ref} className="gh-earnings-dialog gh-earnings-v2" aria-labelledby="gh-earnings-title"
      onCancel={event=>{event.preventDefault();setOpen(false);}}>
      <header className="gh-earnings-dialog__header"><div><small>GRIND HEROES / POWER REWARDS</small><h2 id="gh-earnings-title">GH Earnings</h2></div>
        <button type="button" autoFocus aria-label="Close earnings" onClick={()=>setOpen(false)}>×</button></header>
      <div className="gh-earnings-body" aria-busy={loading}>
        <div className="gh-earnings-unavailable" role="status"><strong>GH payouts are currently unavailable</strong>
          <p>Rewards may be calculated, but they cannot presently be claimed.</p></div>
        {loading && !data ? <p role="status" className="gh-earnings-caption">Loading reward accounting…</p> : null}
        {error ? <p role="alert" className="gh-earnings-dialog__error">{error}{data ? " Previous data is shown below." : ""}</p> : null}
        {data ? <EarningsView data={data} updated={updated} stale={stale} /> : !loading ? <p className="gh-earnings-caption">Reward data is unavailable. No allocation or payment has been confirmed.</p> : null}
      </div>
      <footer className="gh-earnings-actions"><div><small>CLAIM ELIGIBILITY</small><strong>Unavailable</strong></div>
        <button type="button" className="gh-earnings-dialog__refresh" disabled={loading||cooling} onClick={()=>void refresh()}>{loading?"Refreshing…":cooling?"Please wait…":"Refresh"}</button>
        <button type="button" className="gh-earnings-dialog__claim" disabled title="GH payouts are currently unavailable">CLAIM GH · UNAVAILABLE</button></footer>
    </dialog>,document.body) : null}
  </>;
}
