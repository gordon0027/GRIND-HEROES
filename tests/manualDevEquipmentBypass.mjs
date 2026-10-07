// Opt-in DEV integration proof: native under-level equip must not alter Grind authority.
// It creates a fresh DEV guest, earns chests, and opens them; never run in the normal test suite.
import { createIDosGamesClient } from "@idosgames/core";
import assert from "node:assert/strict";
import { combatPower, ownedGear, stageHeroStats, totalBonuses } from "../src/modules/idle-rpg/game/equipment.ts";
import { grindAssignments, parseGrindEquipment } from "../src/modules/idle-rpg/game/grindEquipment.ts";

if (process.env.GRIND_DEV_EQUIP_PROBE !== "1") {
  console.error("Set GRIND_DEV_EQUIP_PROBE=1 to run this mutating DEV-only probe.");
  process.exit(2);
}

const client = createIDosGamesClient({ titleID: "98JRCAKG-DEV" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const script = async (name, args) => {
  const response = await client.cloudCode.execute(name, args);
  if (!response.ok || response.data.Error) throw new Error(`${name}: ${JSON.stringify(response)}`);
  return response.data.FunctionResult;
};
const inventory = () => client.data.user.state?.InventoryV2?.UnstackableItems ?? {};
const refresh = async () => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await client.user.getUserInventory();
    if (response.ok) return;
    if (response.reason !== "throttled") throw new Error(`inventory: ${response.error ?? response.reason}`);
    await sleep(900);
  }
  throw new Error("inventory: throttled after retries");
};

const login = await client.auth.loginWithDeviceID();
if (!login.ok) throw new Error(`login: ${login.error ?? login.reason}`);
await client.user.getClientState();
await client.character.getUserCharacters();
await refresh();
const itemDefs = client.data.config.getSection("Item")?.Catalogs?.Item?.Items ?? {};
const protectedBefore = parseGrindEquipment((await script("getGrindEquipment", {})).equipment);
const defsMap = new Map(Object.entries(itemDefs));
const base = { maxHp: 120, damage: 10, armor: 0, attackSpeed: 1,
  critChance: 0, critMultiplier: 1.5, dodge: 0, regen: 0, multiShot: 0 };
const archetype = { moveSpeed: 140, attackRange: 0.13, cadence: 1, hit: 1 };
const grindPower = (state) => combatPower(stageHeroStats(base, archetype,
  totalBonuses(ownedGear(inventory(), defsMap, grindAssignments(state)), "Knight")));

const findUncommon = () => Object.entries(inventory()).find(([, item]) =>
  itemDefs[item?.ItemID]?.Metadata?.RarityID === "Uncommon" &&
  (itemDefs[item?.ItemID]?.Equipment?.AllowedCharacterIDs?.length === 0 ||
    itemDefs[item?.ItemID]?.Equipment?.AllowedCharacterIDs?.includes("Knight")));

let found = findUncommon();
for (let attempt = 0; attempt < 14 && !found; attempt++) {
  const started = await script("startStageRun", { stageId: "grind-stage-1-1" });
  if (!started?.accepted) throw new Error(`start rejected: ${started?.reason}`);
  await sleep((started.minimumClearSeconds + 1) * 1000);
  const cleared = await script("completeStageRun", { stageId: "grind-stage-1-1", runId: started.runId });
  if (!cleared?.accepted) throw new Error(`clear rejected: ${cleared?.reason}`);
  await refresh();
  if (attempt === 0) {
    const starter = Object.entries(inventory()).find(([, instance]) => instance?.ItemID === "traveler_boots");
    if (!starter) throw new Error("First-clear Traveler Boots missing");
    const wrongSlot = await client.character.equipItems("Knight",
      [{ SlotID: "Weapon", ItemInstanceID: starter[0] }]);
    const notOwned = await client.character.equipItems("Knight",
      [{ SlotID: "Boots", ItemInstanceID: "not-owned-instance" }]);
    const valid = await client.character.equipItems("Knight",
      [{ SlotID: "Boots", ItemInstanceID: starter[0] }]);
    console.log(JSON.stringify({ nativeChecks: {
      wrongSlotRejected: !wrongSlot.ok,
      notOwnedRejected: !notOwned.ok,
      validCommonAccepted: valid.ok,
    } }));
    const gemOpen = await client.lootbox.open("gear_summon", 3, "default");
    if (!gemOpen.ok) throw new Error(`GEMS opening rejected: ${gemOpen.error ?? gemOpen.reason}`);
    await refresh();
    await sleep(900);
  }
  const opened = await client.lootbox.open("gear_summon", 1, "stage");
  if (!opened.ok) throw new Error(`open rejected: ${opened.error ?? opened.reason}`);
  await refresh();
  found = findUncommon();
  console.log(JSON.stringify({ attempt: attempt + 1, heroLevel: cleared.heroProgress?.Knight?.level,
    foundUncommon: Boolean(found) }));
}
if (!found) throw new Error("No Knight Uncommon item in 14 openings");

const [instanceID, item] = found;
const def = itemDefs[item.ItemID];
const slot = def.Equipment.AllowedSlotIDs[0];
const wrongClassItem = Object.entries(inventory()).find(([, instance]) => {
  const allowed = itemDefs[instance?.ItemID]?.Equipment?.AllowedCharacterIDs;
  return allowed?.length > 0 && !allowed.includes("Knight");
});
if (wrongClassItem) {
  const wrongClassDef = itemDefs[wrongClassItem[1].ItemID];
  const wrongClass = await client.character.equipItems("Knight",
    [{ SlotID: wrongClassDef.Equipment.AllowedSlotIDs[0], ItemInstanceID: wrongClassItem[0] }]);
  console.log(JSON.stringify({ nativeChecks: { wrongClassRejected: !wrongClass.ok } }));
}
const hero = (await client.userCustomData.getMyUserCustomData()).data.ReadOnly?.grind_hero_xp_v1?.Value;
const heroLevel = JSON.parse(hero ?? "{}").Knight?.level ?? 1;
const powerBefore = grindPower(protectedBefore);
const result = await client.character.equipItems("Knight", [{ SlotID: slot, ItemInstanceID: instanceID }]);
const nativeID = result.ok ? result.data.Equipment?.[slot]?.ItemInstanceID ?? instanceID : instanceID;
await refresh();
const protectedAfter = parseGrindEquipment((await script("getGrindEquipment", {})).equipment);
const powerAfter = grindPower(protectedAfter);
const bagItem = ownedGear(inventory(), defsMap, grindAssignments(protectedAfter))
  .find((gear) => gear.instanceID === nativeID);
const helper = await script("isGrindEquipped", { itemInstanceID: nativeID });
console.log(JSON.stringify({ directEquip: { heroLevel, requiredLevel: 5, itemID: item.ItemID,
  slot, accepted: result.ok, reason: result.ok ? null : result.error ?? result.reason,
  persisted: inventory()[nativeID]?.EquippedSlot?.CharacterID === "Knight",
  grindStateUnchanged: JSON.stringify(protectedBefore) === JSON.stringify(protectedAfter),
  grindPowerBefore: powerBefore, grindPowerAfter: powerAfter,
  visibleInGrindBag: bagItem?.equippedBy === null, marketplaceHelperEquipped: helper.equipped } }));
assert.equal(heroLevel, 1);
assert.equal(result.ok, true, "known native bypass remains reproducible");
assert.deepEqual(protectedAfter, protectedBefore, "native equip never changes protected assignments");
assert.equal(powerAfter, powerBefore, "native equip cannot boost Grind Power");
assert.equal(bagItem?.equippedBy, null, "native item remains in Grind bag");
assert.equal(helper.equipped, false, "Marketplace helper ignores native equipped record");
const denied = await script("equipGrindItem", { heroID: "Knight", slot, itemInstanceID: nativeID });
assert.equal(denied.reason, "HERO_LEVEL_TOO_LOW", "server rejects native-attested Lv5 gear at Grind Lv1");

const common = Object.entries(inventory()).find(([, instance]) => instance?.ItemID === "traveler_boots");
if (!common) throw new Error("Common Traveler Boots missing");
const alreadyBoots = client.data.user.state?.Character?.Characters?.Knight?.Equipment?.Boots;
let commonID = alreadyBoots?.ItemID === "traveler_boots" ? alreadyBoots.ItemInstanceID : null;
if (!commonID) {
  const nativeCommon = await client.character.equipItems("Knight",
    [{ SlotID: "Boots", ItemInstanceID: common[0] }]);
  if (!nativeCommon.ok) throw new Error(`native Common attestation failed: ${nativeCommon.error ?? nativeCommon.reason}`);
  commonID = nativeCommon.data.Equipment?.Boots?.ItemInstanceID;
}
if (!commonID) throw new Error("native Common attestation has no instance ID");
const accepted = await script("equipGrindItem", { heroID: "Knight", slot: "Boots", itemInstanceID: commonID });
assert.equal(accepted.equipped, true, `valid Grind equip failed: ${accepted.reason}`);
const validState = parseGrindEquipment(accepted.equipment);
assert.ok(grindPower(validState) > powerAfter, "valid Grind equip increases Power");
console.log(JSON.stringify({ validGrindEquip: { itemID: "traveler_boots", slot: "Boots",
  powerBefore: powerAfter, powerAfter: grindPower(validState), equipped: accepted.equipped } }));
process.exit(0);
