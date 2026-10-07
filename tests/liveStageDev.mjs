// Optional integration check on a fresh 98JRCAKG-DEV guest. It grants real DEV rewards.
import assert from "node:assert/strict";

const titleID = "98JRCAKG-DEV";
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const { createIDosGamesClient } = await import("@idosgames/core");
const client = createIDosGamesClient({ titleID, throttleMs: 0 });
const login = await client.auth.loginWithDeviceID();
assert.equal(login.ok, true, "DEV guest login");
const config = client.data.config.config;
assert.ok(config.Lootbox.Definitions.gear_summon.PriceOptions.stage);
assert.ok(config.Lootbox.Definitions.boss_summon.PriceOptions.boss);
assert.ok(config.Item.Catalogs.Item.Items.boss_chest);

async function run(name, args) {
  const result = await client.cloudCode.execute(name, args);
  assert.equal(result.ok, true, `${name} transport`);
  assert.equal(result.data.Error ?? null, null, `${name} script: ${JSON.stringify(result.data.Error)}`);
  return result.data.FunctionResult;
}
async function inventory() {
  const result = await client.user.getUserInventory();
  assert.equal(result.ok, true);
  return client.data.user.state.InventoryV2;
}
const chestCount = (itemID) => Number(client.data.user.state?.InventoryV2?.Items?.[itemID]?.StackableAmount ?? 0);
async function clear(stage, minimumSeconds) {
  const started = await run("startStageRun", { stageId: stage });
  assert.equal(started.accepted, true);
  await new Promise((resolve) => setTimeout(resolve, (minimumSeconds + 0.6) * 1000));
  const completed = await run("completeStageRun", { stageId: stage, runId: started.runId });
  assert.equal(completed.accepted, true);
  await inventory();
  return completed;
}

const first = await clear("grind-stage-1-1", 7);
assert.equal(first.rewards.bossChestItemID, null);
assert.equal(chestCount("stage_chest"), 1, "drop remains unopened");
const repeated = await clear("grind-stage-1-1", 7);
assert.notEqual(repeated.runId, first.runId, "automatic repetitions need fresh IDs");
assert.equal(chestCount("stage_chest"), 2, "repeated farming accumulates chests");
const gearBefore = Object.keys(client.data.user.state.InventoryV2.UnstackableItems ?? {}).length;
const opened = await client.lootbox.open("gear_summon", 1, "stage");
assert.equal(opened.ok, true, String(opened.error ?? opened.reason));
await inventory();
assert.equal(chestCount("stage_chest"), 1, "manual open consumes exactly one");
assert.equal(Object.keys(client.data.user.state.InventoryV2.UnstackableItems ?? {}).length, gearBefore + 1);

for (let number = 2; number <= 4; number++)
  await clear(`grind-stage-1-${number}`, 7 + Math.floor((number - 1) / 3));
const milestone = await clear("grind-stage-1-5", 8);
assert.equal(milestone.rewards.bossChestItemID, "boss_chest");
assert.equal(chestCount("boss_chest"), 1);
const bossOpen = await client.lootbox.open("boss_summon", 1, "boss");
assert.equal(bossOpen.ok, true, String(bossOpen.error ?? bossOpen.reason));
await inventory();
assert.equal(chestCount("boss_chest"), 0);
console.log("DEV: both chests persist unopened, repeat stacks A, manual open consumes one and grants gear");
process.exit(0);
