import assert from "node:assert/strict";
import { wholeGh, waitForAuthoritativeGh } from "../src/base/lobby/ghBalance.ts";

assert.equal(wholeGh("101"), 101n);
assert.equal(wholeGh("101.000"), 101n);
assert.equal(wholeGh("101.1"), null);
assert.equal(wholeGh("Main_IOU"), null);

let reads = 0;
let pauses = 0;
assert.equal(await waitForAuthoritativeGh(8n, async () => {
  reads++;
  if (reads === 1) throw new Error("stale read");
  return reads < 4 ? 7n : 8n;
}, async () => { pauses++; }), true);
assert.equal(reads, 4, "delayed inventory update is re-read without another grant");
assert.equal(pauses, 3);

reads = 0;
assert.equal(await waitForAuthoritativeGh(8n, async () => { reads++; return 7n; }, async () => {}), false);
assert.equal(reads, 5, "no balance delta is never reported as success");

console.log("GH authoritative balance parsing and delayed refresh passed");
