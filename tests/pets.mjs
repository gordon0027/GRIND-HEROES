import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/modules/idle-rpg/server/pets.js", import.meta.url), "utf8");
const records = { ReadOnly: {}, Internal: {} };
const inventory = { Items: {} };
const server = {
  GetUserCustomData: () => ({ Success: true, Data: records }),
  ReadUserData: () => ({ InventoryV2: inventory }),
  SetUserCustomData: (bucket, key, value) => {
    records[bucket][key] = { Value: value };
    return { Success: true };
  },
};
const context = vm.createContext({ server, handlers: {},
  ghReadJson: (bucket, key, fallback) => bucket?.[key]?.Value ? JSON.parse(bucket[key].Value) : fallback,
  GH_ACTIVE_KEY: "grind_stage_active_v2" });
vm.runInContext(source, context);
const state = () => context.handlers.getPetState();
const select = (petId) => context.handlers.selectPet({ petId });
assert.deepEqual(Array.from(state().catalog, (pet) => [pet.id, pet.name, pet.price, pet.currencyID]), [
  ["pet_gold_v1", "Donkey", 100, "GOLD"],
  ["pet_gems_v1", "Pug", 20, "GEMS"],
  ["pet_gh_v1", "Watchdog", 1, "Main"],
]);
assert.equal(state().ownedPetIds.length, 0);
assert.equal(select("pet_gold_v1").reason, "pet_not_owned");
assert.equal(select("forged").reason, "unknown_pet");
inventory.Items.pet_gold_v1 = { StackableAmount: 1 };
inventory.Items.pet_gems_v1 = { StackableAmount: 1 };
assert.equal(select("pet_gold_v1").equippedPetId, "pet_gold_v1");
records.Internal.grind_stage_active_v2 = { Value: JSON.stringify({ status: "active" }) };
assert.equal(select("pet_gems_v1").hasPendingChange, true);
assert.equal(state().equippedPetId, "pet_gold_v1", "running fight keeps its pet");
assert.equal(context.ghPetApplyPending(records), "pet_gems_v1");
assert.equal(state().equippedPetId, "pet_gems_v1");
assert.equal(state().hasPendingChange, false);
delete inventory.Items.pet_gems_v1;
assert.equal(state().equippedPetId, null, "removed pet no longer grants a bonus");
records.Internal.grind_stage_active_v2 = { Value: JSON.stringify({ status: "completed" }) };
assert.equal(select(null).equippedPetId, null);
console.log("Pet ownership, selection, run boundary and revocation passed");
