// TEMPORARY publisher-controlled PROD probe. Append only for a reviewed,
// one-time test revision. Fill the fixed UserID before publication, then
// remove these handlers after the result has been independently checked.
var GH_ONE_GH_PROBE_USER_ID = "";
var GH_ONE_GH_PROBE_KEY = "grind_main_one_gh_probe_v1";

function ghProbeAuthorized(context) {
  return GH_ONE_GH_PROBE_USER_ID !== "" && !!context &&
    context.UserID === GH_ONE_GH_PROBE_USER_ID;
}

function ghProbeSafe(value, depth) {
  if (depth > 5) return "[depth]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value
    .replace(/Bearer\s+[^\s]+|sk-[A-Za-z0-9_-]+/gi, "[credential]")
    .slice(0, 1000);
  if (Array.isArray(value)) return value.slice(0, 30).map(function (entry) {
    return ghProbeSafe(entry, depth + 1);
  });
  if (typeof value === "object") {
    var clean = {};
    Object.keys(value).slice(0, 50).forEach(function (key) {
      if (/token|secret|password|ticket|authorization|privatekey/i.test(key))
        clean[key] = "[redacted]";
      else clean[key] = ghProbeSafe(value[key], depth + 1);
    });
    return clean;
  }
  return String(value).slice(0, 1000);
}

function ghProbeRecord(data) {
  return data.Runtime && data.Runtime.Private && data.Runtime.Private[GH_ONE_GH_PROBE_KEY];
}

handlers.getOneGhPayoutProbeStatus = function (_args, context) {
  if (!ghProbeAuthorized(context)) return { authorized: false };
  var read = server.GetTitleCustomData();
  if (!read || read.Success !== true) throw new Error("gh_probe_state_read_failed");
  var record = ghProbeRecord(read.Data || {});
  return { authorized: true, locked: !!record,
    grantApiAvailable: typeof server.ApplyResourceOperation === "function",
    state: record ? JSON.parse(record.Value).state : "ready" };
};

handlers.runOneGhPayoutProbe = function (_args, context) {
  if (!ghProbeAuthorized(context)) throw new Error("gh_probe_not_authorized");
  if (typeof server.ApplyResourceOperation !== "function")
    return { status: "unsupported_api" };
  // No browser-supplied recipient or amount is accepted. This key is separate
  // from grind_power_reward_state_v1 and is never cleared or retried.
  ghRewardCurrencyReady();
  var startedAtUtc = new Date().toISOString();
  var reason = "grind_main_one_gh_probe_v1:" + GH_ONE_GH_PROBE_USER_ID;
  var lock = { version: 1, state: "unknown", startedAtUtc: startedAtUtc,
    recipient: GH_ONE_GH_PROBE_USER_ID, currency: "Main", units: "1", reason: reason };
  var reserved = server.SetTitleCustomData("Private", GH_ONE_GH_PROBE_KEY,
    JSON.stringify(lock), 0);
  if (!reserved || reserved.Success !== true) return { status: "locked_or_unavailable" };

  var request = { Reason: reason, Operation: { Grant: { Standard: { Entries: [
    { Type: "CryptoCurrency", CurrencyID: "Main", Amount: 1 },
  ] } } } };
  var response;
  try { response = server.ApplyResourceOperation(request); }
  catch (error) {
    return { status: "unknown", request: request,
      error: ghProbeSafe(error && (error.message || String(error)), 0) };
  }
  var status = response && response.Success === true ? "platform_accepted" : "platform_rejected";
  var safeResponse = ghProbeSafe(response, 0);
  var read = server.GetTitleCustomData();
  var record = read && read.Success === true && ghProbeRecord(read.Data || {});
  var saved = record && server.SetTitleCustomData("Private", GH_ONE_GH_PROBE_KEY,
    JSON.stringify({ version: 1, state: status, startedAtUtc: startedAtUtc,
      completedAtUtc: new Date().toISOString(), recipient: GH_ONE_GH_PROBE_USER_ID,
      currency: "Main", units: "1", reason: reason, response: safeResponse }),
    Number(record.Version));
  return { status: status, request: request, response: safeResponse,
    auditStored: !!(saved && saved.Success === true) };
};
