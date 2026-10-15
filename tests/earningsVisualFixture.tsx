// Offline browser fixture; excluded from the production entrypoint. Never contacts an API.
import {useState} from "react";
import {createRoot} from "react-dom/client";
import {EarningsView} from "../src/base/lobby/EarningsView";
import {parseEarnings} from "../src/base/lobby/earningsModel";
import real from "../artifacts/jury-edition/earnings-prod-read.json";
import "../src/base/lobby/grind-frame.css";
import "../src/base/lobby/earnings.css";
const allocation={...real.overview,status:"available",rank:3,power:584,dailyShareUnits:"440",currentWindowUnits:"147"};
const states={
  "Real PROD read":real.overview,
  "Allocation, payouts disabled":allocation,
  "Paused":{...allocation,status:"disabled"},
  "No participants":{...allocation,status:"empty_leaderboard",participantCount:0,rank:null,power:0,dailyShareUnits:"0",currentWindowUnits:"0"},
  "Snapshot not ready":{status:"not_started"},
  "Pending review":{...allocation,status:"review_required",pendingReviewUnits:"180"},
  "Historical payment":{...allocation,paidTotalUnits:"22"},
  "Stale data":allocation,
};
function Fixture(){const [name,setName]=useState<keyof typeof states>("Real PROD read");return <>
  <div style={{color:"#ffe1a1",padding:12,font:"14px system-ui"}}>LOCAL QA · read-only captured response / labelled mock states
    <select aria-label="Earnings QA state" value={name} onChange={e=>setName(e.target.value as keyof typeof states)} style={{margin:8}}>{Object.keys(states).map(s=><option key={s}>{s}</option>)}</select></div>
  <section className="gh-earnings-dialog gh-earnings-v2" style={{position:"relative",display:"flex",flexDirection:"column",maxHeight:"calc(100dvh - 85px)",margin:"0 auto"}}>
    <header className="gh-earnings-dialog__header"><div><small>GRIND HEROES / POWER REWARDS</small><h2>GH Earnings</h2></div><button aria-label="Fixture close" disabled>×</button></header>
    <div className="gh-earnings-body"><div className="gh-earnings-unavailable"><strong>GH payouts are currently unavailable</strong><p>Rewards may be calculated, but they cannot presently be claimed.</p></div>
      <EarningsView data={parseEarnings(states[name])} updated={real.readAt} stale={name==="Stale data"}/></div>
    <footer className="gh-earnings-actions"><div><small>CLAIM ELIGIBILITY</small><strong>Unavailable</strong></div><button className="gh-earnings-dialog__refresh" disabled>Refresh</button><button className="gh-earnings-dialog__claim" disabled>CLAIM GH · UNAVAILABLE</button></footer>
  </section></>}
createRoot(document.getElementById("root")!).render(<Fixture/>);
