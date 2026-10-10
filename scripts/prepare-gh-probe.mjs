// Local-only publisher draft builder. It does not call iDos or publish.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const basePath = resolve(".tmp/gh-prod-rev12-cloudcode.js");
const outputPath = resolve(".tmp/gh-prod-one-gh-probe.js");
const expectedBaseHash = "b9a52bf7bb19f8aacb5b599e84b7b3ac1a0df181c94036f32262872fcdb7a1aa";
// Re-read get_cloud_code immediately before publishing; ActiveRevision must
// still be 12 with this platform CodeHash, or rebuild from the new revision.
const expectedPlatformCodeHash = "1469f7757711d7d9f8d24b2b333cf395cc86e217c966d58220168de21b8ec010";
const marker = "// Protected, Power-weighted GH accrual.";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const base = readFileSync(basePath, "utf8");
if (hash(base) !== expectedBaseHash) throw new Error("PROD revision 12 source changed; fetch it again before drafting");
const markerAt = base.indexOf(marker);
if (markerAt < 0 || base.indexOf(marker, markerAt + 1) >= 0)
  throw new Error("Power reward publisher boundary is not unique");
const userID = process.argv[2] ?? "";
if (userID && !/^[A-Za-z0-9_-]{8,128}$/.test(userID))
  throw new Error("Pass one exact, reviewed iDos UserID; no other characters are allowed");
const reward = readFileSync(resolve("src/modules/idle-rpg/server/powerRewards.js"), "utf8");
let probe = readFileSync(resolve("src/modules/idle-rpg/server/oneGhPayoutProbe.js"), "utf8");
probe = probe.replace('var GH_ONE_GH_PROBE_USER_ID = "";',
  `var GH_ONE_GH_PROBE_USER_ID = ${JSON.stringify(userID)};`);
if (!probe.includes(`var GH_ONE_GH_PROBE_USER_ID = ${JSON.stringify(userID)};`))
  throw new Error("Probe UserID replacement failed");
if (!reward.includes("var GH_POWER_REWARD_CLAIMS_ENABLED = false;"))
  throw new Error("Global payouts must stay closed during the probe");
const code = base.slice(0, markerAt) + reward.trimEnd() + "\n\n" + probe.trimEnd() + "\n";
writeFileSync(outputPath, code, "utf8");
console.log(JSON.stringify({ outputPath, sourceRevision: 12, userConfigured: !!userID,
  expectedPlatformCodeHash, globalClaimsEnabled: false,
  codeBytes: Buffer.byteLength(code), sha256: hash(code) }, null, 2));
