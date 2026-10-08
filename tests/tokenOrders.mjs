import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const source = readFileSync(resolve("src/modules/store/server/tokenOrders.js"), "utf8");
const rows = new Map();
const economy = { gems: 300, token: 0, inventory: [] };
const config = {
  Currency: {
    VirtualCurrencies: { GEMS: { Status: "Active" } },
    CryptoCurrencies: { Main: { Status: "Active", Networks: [{ NetworkID: "solana",
      ContractAddress: "2gzmu2aJtyw35ph7wQhQKTKe9G6rwD91HyjjsEcJidos", Decimals: 0 }] } },
  },
  Item: { Catalogs: { Item: { Items: { premium_chest_v1: { ItemID: "premium_chest_v1" } } } } },
  Lootbox: { Definitions: { premium_equipment_v1: { LootboxID: "premium_equipment_v1" } } },
};
const server = {
  GetTitleConfig: () => ({ Success: true, Data: config }),
  GetDataItem: (_collection, id) => rows.has(id)
    ? { Success: true, Data: { Item: { Data: rows.get(id) } } }
    : { Success: false, Error: "NOT_FOUND" },
  CreateDataItem: (_collection, data, id, owner) => {
    if (rows.has(id)) return { Success: true, Data: { AlreadyExists: true, Item: { Data: rows.get(id) } } };
    assert.equal(owner, data.playerId);
    rows.set(id, structuredClone(data));
    return { Success: true, Data: { AlreadyExists: false, Item: { Data: data } } };
  },
  ApplyResourceOperation: () => { throw new Error("Order creation must not change the economy"); },
};
const sandbox = { handlers: {}, server };
vm.runInNewContext(source, sandbox);
const normalize = (value) => JSON.parse(JSON.stringify(value));
const context = (user) => ({ UserID: user, InvokedAt: "2026-10-08T10:00:00.000Z" });
const keys = [
  "c68163ed-3fb1-442b-b619-28bd7e23b250",
  "c68163ed-3fb1-442b-b619-28bd7e23b251",
  "c68163ed-3fb1-442b-b619-28bd7e23b252",
];
const create = (productId, idempotencyKey, user = "player-a", extra = {}) => normalize(
  sandbox.handlers.createTokenPurchaseOrder({ productId, idempotencyKey, ...extra }, context(user)));

const catalog = normalize(sandbox.handlers.getTokenShopCatalog());
assert.deepEqual(catalog.products.map((p) => p.productId),
  ["gems_small", "gems_medium", "gems_large", "premium_chest_v1"]);
assert.deepEqual(catalog.products.map((p) => p.tokenAmountBaseUnits), ["5", "12", "30", "20"]);
assert.deepEqual(create("unknown", keys[0]), { created: false, reason: "PRODUCT_UNKNOWN" });
assert.deepEqual(create("chest_rare", keys[0]), { created: false, reason: "PRODUCT_DISABLED" });
assert.deepEqual(create("gems_small", keys[0], "player-a", { tokenPrice: 1 }),
  { created: false, reason: "INVALID_REQUEST" });
assert.deepEqual(create("premium_chest_v1", keys[0], "player-a", { rewardReference: "dragon_blade" }),
  { created: false, reason: "INVALID_REQUEST" });

const first = create("gems_small", keys[0]);
assert.equal(first.created, true);
assert.equal(first.order.productId, "gems_small");
assert.equal(first.order.tokenAmountBaseUnits, "5");
assert.equal(first.order.rewardType, "GEMS");
assert.equal(first.order.rewardReference, "GEMS");
assert.equal(first.order.rewardAmount, 500);
assert.equal(first.order.status, "CREATED");
assert.equal(first.order.expiresAt, "2026-10-08T10:20:00.000Z");
assert.equal(rows.size, 1);
assert.deepEqual(create("gems_small", keys[0]), { ...first, reused: true });
assert.equal(rows.size, 1);
assert.deepEqual(create("gems_medium", keys[0]), { created: false, reason: "IDEMPOTENCY_CONFLICT" });
assert.deepEqual(create("gems_small", keys[0], "player-b"),
  { created: false, reason: "IDEMPOTENCY_CONFLICT" });

const chest = create("premium_chest_v1", keys[1]);
assert.equal(chest.order.rewardType, "PREMIUM_CHEST");
assert.equal(chest.order.rewardReference, "premium_chest_v1");
assert.equal(chest.order.lootboxId, "premium_equipment_v1");
assert.equal(chest.order.rewardAmount, 1);
assert.equal(chest.order.tokenAmountBaseUnits, "20");
assert.ok(!Object.hasOwn(rows.get(chest.order.orderId), "paymentTxSignature"));
assert.ok(!Object.hasOwn(rows.get(chest.order.orderId), "rarity"));

assert.deepEqual(normalize(sandbox.handlers.getTokenPurchaseOrder(
  { orderId: first.order.orderId }, context("player-b"))), { found: false });
assert.deepEqual(normalize(sandbox.handlers.getTokenPurchaseOrder(
  { orderId: first.order.orderId }, context("player-a"))),
  { found: true, order: first.order });
assert.equal(normalize(sandbox.handlers.getTokenPurchaseOrder(
  { orderId: first.order.orderId },
  { UserID: "player-a", InvokedAt: "2026-10-08T10:21:00.000Z" })).order.status, "EXPIRED");
assert.notEqual(first.order.orderId, chest.order.orderId);

// A price change affects only newly created orders. Existing records keep their snapshot.
sandbox.GH_TOKEN_PRODUCTS.gems_small.tokenPrice = 9;
const repriced = create("gems_small", keys[2]);
assert.equal(repriced.order.tokenAmountBaseUnits, "9");
assert.equal(create("gems_small", keys[0]).order.tokenAmountBaseUnits, "5");
assert.equal(rows.get(first.order.orderId).tokenAmountBaseUnits, "5");
assert.ok(sandbox.ghTokenAllowedTransition("CREATED", "AWAITING_PAYMENT"));
assert.ok(sandbox.ghTokenAllowedTransition("CONFIRMED", "FULFILLED"));
assert.ok(!sandbox.ghTokenAllowedTransition("CREATED", "FULFILLED"));
assert.ok(!sandbox.ghTokenAllowedTransition("FULFILLED", "CONFIRMED"));
assert.deepEqual(economy, { gems: 300, token: 0, inventory: [] });
console.log("Server token order catalog, ownership, snapshot, retry and no-grant tests passed");
