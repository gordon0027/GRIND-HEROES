// Opt-in, mutating DEV integration probe. Uses fresh guest accounts and real iDos services.
import assert from "node:assert/strict";
import { createIDosGamesClient } from "@idosgames/core";
import { GrindEquipmentService } from "../src/modules/idle-rpg/game/grindEquipment.ts";

if (process.env.GRIND_DEV_MARKETPLACE_PROBE !== "1") {
  console.error("Set GRIND_DEV_MARKETPLACE_PROBE=1 to run this DEV-only probe.");
  process.exit(2);
}

const titleID = "98JRCAKG-DEV";
const seller = createIDosGamesClient({ titleID });
const buyer = createIDosGamesClient({ titleID });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const call = async (name, action) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await action();
    if (result.ok || result.reason !== "throttled") return result;
    await sleep(800);
  }
  throw new Error(`${name}: throttled after retries`);
};
const must = (name, result) => {
  if (!result.ok) throw new Error(`${name}: ${result.error ?? result.reason}`);
  return result.data;
};
const script = async (client, name, args = {}) => {
  const response = must(name, await call(name, () => client.cloudCode.execute(name, args)));
  if (response.Error) throw new Error(`${name}: ${response.Error.Message ?? response.Error.Error}`);
  return response.FunctionResult;
};
const inventory = async (client) => must("inventory", await call("inventory", () => client.user.getUserInventory()));
const gems = (state) => Number(state.VirtualCurrencies?.GEMS?.Amount ?? 0);
const instances = (state) => state.UnstackableItems ?? {};
const price = (amount) => ({ Entries: [{ Type: "VirtualCurrency", CurrencyID: "GEMS", Amount: amount }] });
const list = (client, instanceID, itemID, amount) => call("createListing", () =>
  client.marketplace.createListing(itemID, "Item", 1, price(amount), 24, [instanceID]));
const liveOffers = async (client, itemID) => must("offers", await call("offers", () =>
  client.marketplace.getOffersByItem(itemID, "Listing"))).Offers ?? [];

let cleanupOfferID = null;
let equippedOfferID = null;
let failure = null;
try {
  for (const client of [seller, buyer]) {
    must("login", await client.auth.loginWithDeviceID());
    must("client state", await client.user.getClientState());
    must("marketplace definitions", await client.marketplace.getDefinitions());
  }
  assert.notEqual(seller.auth.context?.userID, buyer.auth.context?.userID);
  const beforeSeller = structuredClone(await inventory(seller));
  const beforeBuyer = structuredClone(await inventory(buyer));
  const beforeIDs = new Set(Object.keys(instances(beforeSeller)));
  must("open gear summon", await seller.lootbox.open("gear_summon", 1, "default"));
  const afterOpen = structuredClone(await inventory(seller));
  const newGear = Object.entries(instances(afterOpen)).find(([id]) => !beforeIDs.has(id));
  assert.ok(newGear, "gear summon did not grant a new instance");
  const [saleInstanceID, saleItem] = newGear;
  assert.ok(saleItem.ItemID);

  const created = must("create sale listing", await list(seller, saleInstanceID, saleItem.ItemID, 1));
  cleanupOfferID = created.OfferID;
  assert.ok(cleanupOfferID);
  const duplicate = await list(seller, saleInstanceID, saleItem.ItemID, 1);
  assert.equal(duplicate.ok, false, "same escrowed instance created a second listing");
  const listedInventory = structuredClone(await inventory(seller));
  assert.equal(instances(listedInventory)[saleInstanceID], undefined, "listed instance stayed in seller inventory");
  const visible = (await liveOffers(buyer, saleItem.ItemID)).find((offer) => offer.OfferID === cleanupOfferID);
  assert.ok(visible, "buyer cannot see seller listing");
  const detail = must("offer detail", await buyer.marketplace.getOffer(cleanupOfferID));
  assert.equal(detail.Offer?.GoodsItemID, saleItem.ItemID);

  const purchase = must("buy", await buyer.marketplace.buy(cleanupOfferID));
  cleanupOfferID = null;
  const afterBuyer = structuredClone(await inventory(buyer));
  const afterSeller = structuredClone(await inventory(seller));
  const buyerNew = Object.entries(instances(afterBuyer)).filter(([id]) =>
    !instances(beforeBuyer)[id] && afterBuyer.UnstackableItems[id]?.ItemID === saleItem.ItemID);
  assert.equal(buyerNew.length, 1, "buyer did not receive exactly one purchased item");
  assert.equal(buyerNew[0][1].Level, saleItem.Level,
    "purchased equipment level differs from the listed instance");
  assert.equal(Object.values(instances(afterSeller)).filter((item) => item.ItemID === saleItem.ItemID).length,
    Object.values(instances(beforeSeller)).filter((item) => item.ItemID === saleItem.ItemID).length,
    "seller still owns an extra sale item after purchase");
  const stillVisible = (await liveOffers(buyer, saleItem.ItemID)).some((offer) => offer.OfferID === created.OfferID);
  assert.equal(stillVisible, false, "completed listing is still visible");
  const oldRelist = await list(seller, saleInstanceID, saleItem.ItemID, 1);
  assert.equal(oldRelist.ok, false, "seller can still relist sold instance");
  await sleep(800);
  const repeatBuy = await buyer.marketplace.buy(created.OfferID);
  assert.equal(repeatBuy.ok, false, "completed listing was bought twice");
  console.log(JSON.stringify({ buyFlow: {
    sellerUserID: seller.auth.context?.userID, buyerUserID: buyer.auth.context?.userID,
    offerID: created.OfferID, itemID: saleItem.ItemID, originalInstanceID: saleInstanceID,
    buyerInstanceID: buyerNew[0][0], originalInstancePreserved: buyerNew[0][0] === saleInstanceID,
    gems: { sellerBefore: gems(listedInventory), sellerAfter: gems(afterSeller),
      buyerBefore: gems(beforeBuyer), buyerAfter: gems(afterBuyer) },
    listingGone: !stillVisible, repeatBuy: repeatBuy.error ?? repeatBuy.reason,
    duplicateListingRejected: !duplicate.ok, oldRelistRejected: !oldRelist.ok,
    settlement: purchase.Settlement ?? null,
  } }));

  const started = await script(seller, "startStageRun", { stageId: "grind-stage-1-1" });
  assert.equal(started.accepted, true);
  await sleep((started.minimumClearSeconds + 1) * 1000);
  const clear = await script(seller, "completeStageRun", { stageId: "grind-stage-1-1", runId: started.runId });
  assert.equal(clear.accepted, true);
  const withBoots = await inventory(seller);
  const boots = Object.entries(instances(withBoots)).find(([, item]) => item.ItemID === "traveler_boots");
  assert.ok(boots, "first clear did not grant Traveler Boots");
  const [bootsID] = boots;
  const native = must("native equip", await seller.character.equipItems("Knight",
    [{ SlotID: "Boots", ItemInstanceID: bootsID }]));
  const equippedID = native.Equipment?.Boots?.ItemInstanceID;
  assert.ok(equippedID);
  const grind = await script(seller, "equipGrindItem", { heroID: "Knight", slot: "Boots", itemInstanceID: equippedID });
  assert.equal(grind.equipped, true);
  const preflight = await script(seller, "isGrindEquipped", { itemInstanceID: equippedID });
  assert.equal(preflight.equipped, true);
  const direct = await list(seller, equippedID, "traveler_boots", 1);
  if (direct.ok) equippedOfferID = direct.data.OfferID;
  console.log(JSON.stringify({ equippedBypass: {
    itemInstanceID: equippedID, grindEquipped: preflight.equipped,
    directListingAccepted: direct.ok, error: direct.ok ? null : direct.error ?? direct.reason,
  } }));
  if (equippedOfferID) {
    must("cancel unexpected equipped listing", await seller.marketplace.cancelListing(equippedOfferID));
    equippedOfferID = null;
  }
  must("native unequip bypass", await seller.character.unequipItems("Knight", ["Boots"]));
  const bypass = await list(seller, equippedID, "traveler_boots", 1);
  if (bypass.ok) equippedOfferID = bypass.data.OfferID;
  console.log(JSON.stringify({ nativeUnequipBypass: {
    directListingAccepted: bypass.ok, error: bypass.ok ? null : bypass.error ?? bypass.reason,
  } }));
  if (equippedOfferID) {
    must("cancel native bypass listing", await seller.marketplace.cancelListing(equippedOfferID));
    equippedOfferID = null;
  }
  const afterNative = await script(seller, "isGrindEquipped", { itemInstanceID: equippedID });
  assert.equal(afterNative.equipped, false,
    "native unequip must revoke protected Grind assignment on the next authoritative read");
  const returnedInventory = await inventory(seller);
  const returnedBoots = Object.entries(instances(returnedInventory)).find(([, item]) => item.ItemID === "traveler_boots");
  assert.ok(returnedBoots);
  const nativeAgain = must("native re-equip", await seller.character.equipItems("Knight",
    [{ SlotID: "Boots", ItemInstanceID: returnedBoots[0] }]));
  const reequippedID = nativeAgain.Equipment?.Boots?.ItemInstanceID;
  assert.ok(reequippedID);
  assert.equal((await script(seller, "equipGrindItem", { heroID: "Knight", slot: "Boots",
    itemInstanceID: reequippedID })).equipped, true);
  await new GrindEquipmentService(seller).unequip("Knight", "Boots");
  const freeInventory = await inventory(seller);
  const freeBoots = Object.entries(instances(freeInventory)).find(([, item]) => item.ItemID === "traveler_boots");
  assert.ok(freeBoots);
  assert.equal(freeBoots[1].EquippedSlot == null, true,
    "normal Grind unequip must release the native Marketplace listing guard");
  console.log(JSON.stringify({ unequipSync: { returnedInstanceID: freeBoots[0],
    grindEquipped: (await script(seller, "isGrindEquipped", { itemInstanceID: freeBoots[0] })).equipped,
    nativeEquipped: !!freeBoots[1].EquippedSlot } }));
  const freeListing = must("list unequipped boots", await list(seller, freeBoots[0], "traveler_boots", 1000));
  cleanupOfferID = freeListing.OfferID;
  assert.ok(cleanupOfferID);
  const insufficient = await buyer.marketplace.buy(cleanupOfferID);
  assert.equal(insufficient.ok, false, "buyer bought unaffordable listing");
  const stillThere = (await liveOffers(buyer, "traveler_boots")).some((offer) => offer.OfferID === cleanupOfferID);
  assert.equal(stillThere, true, "insufficient funds removed the listing");
  console.log(JSON.stringify({ insufficientGems: { balance: gems(await inventory(buyer)),
    error: insufficient.error ?? insufficient.reason, listingStillActive: stillThere } }));
} catch (error) {
  failure = error;
  console.error(error);
} finally {
  if (equippedOfferID) {
    const result = await call("cleanup equipped offer", () => seller.marketplace.cancelListing(equippedOfferID));
    console.log(JSON.stringify({ cleanupEquippedOffer: result.ok, error: result.error }));
  }
  if (cleanupOfferID) {
    const result = await call("cleanup offer", () => seller.marketplace.cancelListing(cleanupOfferID));
    console.log(JSON.stringify({ cleanupOffer: result.ok, error: result.error }));
  }
  process.exit(failure ? 1 : 0);
}
