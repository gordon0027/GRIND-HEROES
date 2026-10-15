import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEarnings, earningsStatus, ghAmount, utcTime } from "../src/base/lobby/earningsModel.ts";
const overview={status:"available",day:"2026-10-15",budgetRemainingUnits:"38771",dailyBudgetUnits:"3877",participantCount:12,
  rank:3,power:584,dailyShareUnits:"440",currentWindowUnits:"147",inactiveCreditUnits:"0",pendingReviewUnits:"0",
  paidTotalUnits:"22",claimedWindow:false,cooldownUntilUtc:null,window:2,nextWindowAtUtc:"2026-10-15T16:00:00Z"};
for (const status of ["available","disabled","empty_leaderboard","not_started","review_required","insufficient_budget","cooldown","nothing_owed"]) {
  const parsed=parseEarnings({...overview,status,cooldownUntilUtc:"2026-10-15T18:00:00Z"});
  assert.ok(earningsStatus(parsed).length>20);
  assert.equal(parsed.dailyShareUnits,"440");assert.equal(parsed.paidTotalUnits,"22");
}
assert.match(earningsStatus(parseEarnings(overview)),/not currently claimable/);
assert.match(earningsStatus(parseEarnings({...overview,status:"review_required",pendingReviewUnits:"180"})),/not a confirmed payment/);
assert.equal(parseEarnings({status:"disabled"}).dailyShareUnits,null,"missing values remain unknown");
assert.equal(ghAmount(null),"—");assert.equal(ghAmount("9007199254740993000"),"9,007,199,254,740,993,000 GH");
assert.match(utcTime(overview.nextWindowAtUtc),/16:00 UTC/);
for (const value of [null,{}, {status:"available",dailyShareUnits:1},{...overview,paidTotalUnits:"NaN"},
  {...overview,participantCount:-1},{...overview,window:4},{...overview,power:1.2},{...overview,nextWindowAtUtc:"bad"}])
  assert.throws(()=>parseEarnings(value));
// No route, click or query parameter in the player UI can perform a payout or financial probe.
const source=readFileSync("src/base/lobby/Earnings.tsx","utf8");
assert.doesNotMatch(source,/claimPowerRewards|runOneGhPayoutProbe|ApplyResourceOperation/);
assert.match(source,/Date.now\(\) - lastRequest.current < 5000/);
assert.match(source,/CLAIM GH · UNAVAILABLE/);
console.log("Earnings sparse/paused/review/historical/invalid data, exact units, UTC, refresh guard and no-payout UI passed");
