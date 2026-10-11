// Appended to the title's CloudCode source. Purchases are native Store operations;
// this code only reads the resulting server-owned Item and selects one team pet.
var GH_PET_KEY = "grind_pets_v1";
var GH_PET_CATALOG = [
  { id: "pet_gold_v1", name: "Trail Pup", itemID: "pet_gold_v1", offerID: "pet_gold_v1",
    assetKey: "pet_gold_v1", currencyID: "GOLD", price: 100, bonus: { attack: 0, maxHp: 20 } },
  { id: "pet_gems_v1", name: "Spark Fox", itemID: "pet_gems_v1", offerID: "pet_gems_v1",
    assetKey: "pet_gems_v1", currencyID: "GEMS", price: 20, bonus: { attack: 3, maxHp: 0 } },
  { id: "pet_gh_v1", name: "Astral Wisp", itemID: "pet_gh_v1", offerID: "pet_gh_v1",
    assetKey: "pet_gh_v1", currencyID: "Main", price: 1, bonus: { attack: 5, maxHp: 30 } },
];

function ghPetByID(id) {
  return GH_PET_CATALOG.filter(function (pet) { return pet.id === id; })[0] || null;
}

function ghPetOwnedIds() {
  var player = server.ReadUserData(["InventoryV2"]);
  if (!player || !player.InventoryV2) throw new Error("pet_inventory_unavailable");
  var items = player.InventoryV2.Items || {};
  return GH_PET_CATALOG.filter(function (pet) {
    return Number(items[pet.itemID] && items[pet.itemID].StackableAmount || 0) >= 1;
  }).map(function (pet) { return pet.id; });
}

function ghPetRecord(data, owned) {
  var saved = ghReadJson(data.ReadOnly, GH_PET_KEY, {});
  var active = saved && owned.indexOf(saved.equippedPetId) >= 0 ? saved.equippedPetId : null;
  var pending = saved && Object.prototype.hasOwnProperty.call(saved, "pendingPetId")
    ? (saved.pendingPetId === null || owned.indexOf(saved.pendingPetId) >= 0 ? saved.pendingPetId : null)
    : undefined;
  return { equippedPetId: active, pendingPetId: pending };
}

function ghSavePetRecord(state) {
  var write = server.SetUserCustomData("ReadOnly", GH_PET_KEY, JSON.stringify(state));
  if (!write.Success) throw new Error("pet_state_write_failed: " + write.Error);
}

// Called only when a new server run starts. Pending changes cannot alter an active battle.
function ghPetApplyPending(data) {
  var owned = ghPetOwnedIds();
  var state = ghPetRecord(data, owned);
  if (state.pendingPetId !== undefined) {
    state.equippedPetId = state.pendingPetId;
    delete state.pendingPetId;
    ghSavePetRecord(state);
  }
  return state.equippedPetId;
}

handlers.getPetState = function () {
  var data = server.GetUserCustomData();
  if (!data.Success) throw new Error("pet_state_read_failed: " + data.Error);
  var owned = ghPetOwnedIds();
  var state = ghPetRecord(data.Data, owned);
  return { catalog: GH_PET_CATALOG, ownedPetIds: owned,
    equippedPetId: state.equippedPetId, pendingPetId: state.pendingPetId === undefined ? null : state.pendingPetId,
    hasPendingChange: state.pendingPetId !== undefined };
};

handlers.selectPet = function (args) {
  var id = args && args.petId;
  if (id !== null && (!ghPetByID(id) || typeof id !== "string"))
    return { selected: false, reason: "unknown_pet" };
  var data = server.GetUserCustomData();
  if (!data.Success) throw new Error("pet_state_read_failed: " + data.Error);
  var owned = ghPetOwnedIds();
  if (id !== null && owned.indexOf(id) < 0) return { selected: false, reason: "pet_not_owned" };
  var state = ghPetRecord(data.Data, owned);
  var active = ghReadJson(data.Data.Internal, GH_ACTIVE_KEY, null);
  var running = !!active && active.status === "active";
  if (running) state.pendingPetId = id;
  else { state.equippedPetId = id; delete state.pendingPetId; }
  ghSavePetRecord(state);
  return { selected: true, equippedPetId: state.equippedPetId,
    pendingPetId: state.pendingPetId === undefined ? null : state.pendingPetId,
    hasPendingChange: state.pendingPetId !== undefined };
};
