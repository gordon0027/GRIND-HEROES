import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/modules/idle-rpg/server/oneGhPayoutProbe.js", import.meta.url), "utf8")
  .replace('var GH_ONE_GH_PROBE_USER_ID = "";', 'var GH_ONE_GH_PROBE_USER_ID = "authorized-test-account";');

function harness(outcome = "success") {
  let record = null;
  let calls = 0;
  let operations = [];
  const server = {
    GetTitleCustomData: () => ({ Success: true, Data: { Runtime: { Private:
      record ? { grind_main_one_gh_probe_v1: record } : {} } } }),
    SetTitleCustomData: (_bucket, key, value, expectedVersion) => {
      assert.equal(key, "grind_main_one_gh_probe_v1");
      if (expectedVersion !== (record?.Version ?? 0))
        return { Success: false, Error: "version_conflict" };
      record = { Value: value, Version: (record?.Version ?? 0) + 1 };
      return { Success: true };
    },
    ApplyResourceOperation: (request) => {
      calls++;
      operations.push(request);
      if (outcome === "unknown") throw new Error("transport unknown");
      if (outcome === "rejected") return { Success: false,
        Error: "Server-issued grants of crypto 'Main' are disabled for this title." };
      return { Success: true, Data: { TransactionID: "receipt-1", SessionTicket: "secret" } };
    },
  };
  const context = vm.createContext({ server, handlers: {},
    ghRewardCurrencyReady: () => {}, Date });
  vm.runInContext(source, context);
  return { context, get calls() { return calls; }, get operations() { return operations; },
    get record() { return record && JSON.parse(record.Value); },
    status: (id) => context.handlers.getOneGhPayoutProbeStatus({}, { UserID: id }),
    run: (id, args = {}) => context.handlers.runOneGhPayoutProbe(args, { UserID: id }),
  };
}

for (const outcome of ["success", "rejected", "unknown"]) {
  const test = harness(outcome);
  assert.equal(test.status("another-account").authorized, false);
  assert.throws(() => test.run("another-account"), /not_authorized/);
  assert.equal(test.calls, 0);
  assert.equal(test.status("authorized-test-account").state, "ready");
  assert.equal(test.status("authorized-test-account").grantApiAvailable, true);
  const result = test.run("authorized-test-account", { UserID: "another-account", Amount: 999 });
  assert.equal(test.calls, 1);
  assert.equal(test.operations[0].Operation.Grant.Standard.Entries[0].Amount, 1);
  assert.equal(test.operations[0].Operation.Grant.Standard.Entries[0].CurrencyID, "Main");
  assert.equal(test.operations[0].Operation.Grant.Standard.Entries[0].Type, "CryptoCurrency");
  assert.equal(test.record.units, "1");
  assert.equal(test.record.recipient, "authorized-test-account");
  assert.equal(test.status("authorized-test-account").locked, true);
  assert.equal(test.run("authorized-test-account").status, "locked_or_unavailable");
  assert.equal(test.calls, 1, "a repeated request never grants twice");
  if (outcome === "success") {
    assert.equal(result.status, "platform_accepted");
    assert.equal(result.response.Data.SessionTicket, "[redacted]");
    assert.equal(result.auditStored, true);
  } else if (outcome === "rejected") {
    assert.equal(result.status, "platform_rejected");
    assert.equal(result.response.Error,
      "Server-issued grants of crypto 'Main' are disabled for this title.");
    assert.equal(test.record.state, "platform_rejected");
    assert.equal(result.auditStored, true);
  } else {
    assert.equal(result.status, "unknown");
    assert.equal(test.record.state, "unknown");
  }
}

const unsupported = harness();
delete unsupported.context.server.ApplyResourceOperation;
assert.equal(unsupported.status("authorized-test-account").grantApiAvailable, false);
assert.equal(unsupported.run("authorized-test-account").status, "unsupported_api");
assert.equal(unsupported.record, null);
assert.equal(unsupported.calls, 0);

console.log("One-GH PROD probe authorization, exact amount and permanent lock passed");
