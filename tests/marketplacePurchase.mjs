import assert from "node:assert/strict";
import { purchaseListing } from "../src/modules/marketplace/purchase.ts";

function clientWith(buyResult, inventoryResult = { ok: true, data: {} }, offerResult) {
  const calls = [];
  return { calls, client: {
    marketplace: {
      buy: async (id) => { calls.push(["buy", id]); return buyResult; },
      getOffer: async (id) => { calls.push(["getOffer", id]); return offerResult; },
    },
    user: { getUserInventory: async () => {
      calls.push(["getUserInventory"]);
      return inventoryResult;
    } },
  } };
}

const success = clientWith({ ok: true, data: { Settlement: {} } });
assert.deepEqual(await purchaseListing(success.client, "lot-1"),
  { kind: "purchased", inventorySynced: true });
assert.deepEqual(success.calls, [["buy", "lot-1"], ["getUserInventory"]],
  "a confirmed purchase fetches authoritative inventory exactly once");

const inventoryFailure = clientWith({ ok: true, data: {} },
  { ok: false, reason: "connection", error: "offline" });
assert.deepEqual(await purchaseListing(inventoryFailure.client, "lot-2"),
  { kind: "purchased", inventorySynced: false },
  "an inventory refresh failure never recasts a settled buy as a failed purchase");

const inventoryThrows = clientWith({ ok: true, data: {} });
inventoryThrows.client.user.getUserInventory = async () => { throw new Error("offline"); };
assert.deepEqual(await purchaseListing(inventoryThrows.client, "lot-2b"),
  { kind: "purchased", inventorySynced: false },
  "a thrown inventory refresh also preserves the settled purchase result");

const sold = clientWith({ ok: false, reason: "server", error: "Offer is already Completed." });
assert.deepEqual(await purchaseListing(sold.client, "lot-3"), { kind: "unavailable" });
assert.deepEqual(sold.calls, [["buy", "lot-3"]], "known sold status needs no extra fetch");

const stale = clientWith({ ok: false, reason: "server", error: "Offer changed." },
  undefined, { ok: true, data: { Offer: { Status: "Cancelled" } } });
assert.deepEqual(await purchaseListing(stale.client, "lot-4"), { kind: "unavailable" },
  "current server offer status resolves unknown stale wording");

const poor = clientWith({ ok: false, reason: "server",
  error: "From validation: VC GEMS: insufficient balance (have 1, need 2, min 0)." });
assert.deepEqual(await purchaseListing(poor.client, "lot-5"), { kind: "insufficient" });
assert.deepEqual(poor.calls, [["buy", "lot-5"]],
  "insufficient funds never refresh inventory as if purchase succeeded");

const offline = clientWith({ ok: false, reason: "connection", error: "offline" });
assert.deepEqual(await purchaseListing(offline.client, "lot-6"),
  { kind: "failed", error: "offline" });
assert.deepEqual(offline.calls, [["buy", "lot-6"]]);

console.log("Marketplace purchase settlement, inventory sync, sold listing and insufficient balance passed");
