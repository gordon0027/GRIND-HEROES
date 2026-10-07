import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { availableGear, combatPower, compareGear, equipProblem, equipProblems, equippedIn, gearBonuses,
  RARITY_LEVELS,
  gearAllowsHero, ownedGear, stageHeroStats, totalBonuses } from "../src/modules/idle-rpg/game/equipment.ts";
import { StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";
import { emptySlotIcon, EQUIPMENT_ICON_TIERS, gearIcon, inventoryHero } from "../src/modules/idle-rpg/ui/inventoryPresentation.ts";

const catalogMatrix = [
  ["leather_helmet", "Helmet", null, "assets/ui/icons/helmet/leather_helmet.png"],
  ["leather_vest", "Armor", null, "assets/ui/icons/armor/leather_vest.png"],
  ["training_gloves", "Gloves", null, "assets/ui/icons/gloves/training_gloves.png"],
  ["traveler_boots", "Boots", null, "assets/ui/icons/boots/traveler_boots.png"],
  ["iron_sword", "Weapon", "Knight", "assets/ui/icons/sword/iron_sword.png"],
  ["oak_shield", "Offhand", "Knight", "assets/ui/icons/shield/oak_shield.png"],
  ["hunter_bow", "Weapon", "Archer", "assets/ui/icons/bow/hunter_bow.png"],
  ["arrow_quiver", "Offhand", "Archer", "assets/ui/icons/quiver/arrow_quiver.png"],
  ["crystal_staff", "Weapon", "Mage", "assets/ui/icons/staff/crystal_staff.png"],
  ["apprentice_orb", "Offhand", "Mage", "assets/ui/icons/orb/apprentice_orb.png"],
];
const matrixDefs = new Map(catalogMatrix.map(([id, slot, hero]) => [id, {
  DisplayName: id, Equipment: { AllowedSlotIDs: [slot], AllowedCharacterIDs: hero ? [hero] : [] },
}]));
const matrixInstances = Object.fromEntries(catalogMatrix.map(([id]) => [id, { ItemID: id, EquippedSlot: null }]));
const matrixItems = ownedGear(matrixInstances, matrixDefs);
assert.equal(inventoryHero([], "Knight"), null, "wait for owned hero data before rendering slots");
assert.equal(inventoryHero([{ id: "Knight", rank: 0 }, { id: "Archer", rank: 1 }], "Knight"), "Archer");
assert.equal(inventoryHero([{ id: "Knight", rank: 1 }, { id: "Archer", rank: 1 }], "Knight"), "Knight");
for (const hero of ["Knight", "Archer", "Mage"]) {
  for (const [id, , required, expectedIcon] of catalogMatrix) {
    const item = matrixItems.find((entry) => entry.itemID === id);
    assert.equal(gearIcon(item), expectedIcon, `${id} icon must stay the same for ${hero}`);
    assert.equal(gearAllowsHero(item, hero), !required || required === hero,
      `${id} compatibility derives immediately for ${hero}`);
    assert.equal(equipProblem(item, hero, 30, true, new Set(["Helmet", "Armor", "Gloves", "Boots", "Weapon", "Offhand"])),
      !required || required === hero ? null : `Requires ${required}`,
      `${id} cannot be equipped by the wrong hero`);
  }
}
assert.deepEqual(RARITY_LEVELS, { Common: 1, Uncommon: 5, Rare: 10, Epic: 15, Legendary: 20 });
assert.equal(Object.values(EQUIPMENT_ICON_TIERS).flat().length, 50);
assert.equal(new Set(Object.values(EQUIPMENT_ICON_TIERS).flat()).size, 50);
const familySlots = { sword: "Weapon", shield: "Offhand", helmet: "Helmet", armor: "Armor",
  gloves: "Gloves", boots: "Boots", bow: "Weapon", quiver: "Offhand", staff: "Weapon", orb: "Offhand" };
const familyHeroes = { sword: "Knight", shield: "Knight", bow: "Archer", quiver: "Archer",
  staff: "Mage", orb: "Mage" };
const rarities = Object.keys(RARITY_LEVELS);
for (const [family, names] of Object.entries(EQUIPMENT_ICON_TIERS))
  for (const [index, name] of names.entries()) {
    assert.ok(existsSync(`public/assets/ui/icons/${family}/${name}.png`), `${family}/${name} art exists`);
    const definition = new Map([[name, { DisplayName: name, Metadata: { RarityID: rarities[index] },
      Equipment: { AllowedSlotIDs: [familySlots[family]],
        AllowedCharacterIDs: familyHeroes[family] ? [familyHeroes[family]] : [] } }]]);
    const [piece] = ownedGear({ piece: { ItemID: name } }, definition);
    assert.equal(piece.requiredLevel, RARITY_LEVELS[rarities[index]], `${name} tier level`);
    assert.equal(gearIcon(piece), `assets/ui/icons/${family}/${name}.png`, `${name} final art`);
  }
assert.equal(gearIcon({ ...matrixItems.find((item) => item.itemID === "iron_sword"),
  itemID: "future_knight_blade", rarity: "Legendary" }),
  "assets/ui/icons/sword/dragon_blade.png", "unknown IDs use family and rarity");
for (const [hero, weapon, offhand] of [
  ["Knight", "icon_equip_sword", "icon_equip_shield"],
  ["Archer", "icon_equip_arrow", "icon_equip_arrows"],
  ["Mage", "function_icon_wand", "function_icon_magicball"],
]) {
  assert.equal(emptySlotIcon("Weapon", hero), weapon);
  assert.equal(emptySlotIcon("Offhand", hero), offhand);
}
assert.equal(emptySlotIcon("Helmet", "Mage"), "icon_equip_helmet_0");
assert.equal(availableGear(matrixItems).length, catalogMatrix.length);
assert.equal(availableGear(matrixItems.map((item) => item.itemID === "hunter_bow"
  ? { ...item, equippedBy: { heroID: "Archer", slot: "Weapon" } } : item)).length,
catalogMatrix.length - 1, "equipped gear stays out of the shared inventory for every hero");

const defs = new Map([
  ["boots", { DisplayName: "Boots", Metadata: { RarityID: "Common" },
    Stats: { FlatBonuses: { MoveSpeed: 15 } }, Equipment: { AllowedSlotIDs: ["Boots"], AllowedCharacterIDs: [] } }],
  ["sword", { DisplayName: "Sword", Metadata: { RarityID: "Rare" },
    Stats: { FlatBonuses: { Damage: 12 } }, Equipment: { AllowedSlotIDs: ["Weapon"], AllowedCharacterIDs: ["Knight"] } }],
  ["bow", { DisplayName: "Bow", Metadata: { RarityID: "Uncommon" },
    Stats: { FlatBonuses: { Damage: 8 } }, Equipment: { AllowedSlotIDs: ["Weapon"], AllowedCharacterIDs: ["Archer"] } }],
  ["staff", { DisplayName: "Staff", Metadata: { RarityID: "Epic" },
    Stats: { FlatBonuses: { Damage: 20 } }, Equipment: { AllowedSlotIDs: ["Weapon"], AllowedCharacterIDs: ["Mage"] } }],
]);
const inventory = {
  boots1: { ItemID: "boots", Level: 1, EquippedSlot: { CharacterID: "Knight", SlotID: "Boots" } },
  sword1: { ItemID: "sword", Level: 1, EquippedSlot: null },
  bow1: { ItemID: "bow", Level: 1, EquippedSlot: null },
  staff1: { ItemID: "staff", Level: 1, EquippedSlot: null },
};
const items = ownedGear(inventory, defs);
const boots = items.find((item) => item.itemID === "boots");
const sword = items.find((item) => item.itemID === "sword");
const bow = items.find((item) => item.itemID === "bow");
const staff = items.find((item) => item.itemID === "staff");
const slots = new Set(["Helmet", "Armor", "Gloves", "Boots", "Weapon", "Offhand"]);
assert.equal(equipProblem({ ...boots, equippedBy: null }, "Knight", 1, true, slots), null);
assert.equal(equipProblem({ ...boots, equippedBy: null }, "Archer", 1, true, slots), null);
assert.equal(equipProblem({ ...boots, equippedBy: null }, "Mage", 1, true, slots), null);
assert.equal(equipProblem(sword, "Archer", 30, true, slots), "Requires Knight");
assert.equal(equipProblem(sword, "Mage", 30, true, slots), "Requires Knight");
assert.equal(equipProblem(bow, "Knight", 30, true, slots), "Requires Archer");
assert.equal(equipProblem(bow, "Mage", 30, true, slots), "Requires Archer");
assert.equal(equipProblem(staff, "Knight", 30, true, slots), "Requires Mage");
assert.equal(equipProblem(staff, "Archer", 30, true, slots), "Requires Mage");
assert.equal(equipProblem(boots, "Archer", 30, true, slots), "Equipped by Knight",
  "one authoritative instance cannot be equipped by two heroes");
assert.equal(equipProblem(sword, "Knight", 30, false, slots), "Hero is locked");
assert.equal(equipProblem(sword, "Knight", 30, true, new Set(["Armor"])), "No Weapon slot");
assert.deepEqual(equipProblems(sword, "Archer", 4, true, slots), ["Requires Knight", "Requires Lv 10"]);
assert.equal(equipProblem(sword, "Knight", 9, true, slots), "Requires Lv 10");
assert.equal(equipProblem(sword, "Knight", 10, true, slots), null);
assert.equal(equipProblem(bow, "Archer", 4, true, slots), "Requires Lv 5");
assert.equal(equipProblem(bow, "Archer", 5, true, slots), null);
assert.equal(equipProblem(staff, "Mage", 14, true, slots), "Requires Lv 15");
assert.equal(equipProblem(staff, "Mage", 15, true, slots), null);
assert.equal(equippedIn(items, "Knight", "Boots")?.instanceID, "boots1");
assert.deepEqual(availableGear(items).map((item) => item.instanceID).sort(), ["bow1", "staff1", "sword1"]);
const archerWearsBow = ownedGear({ ...inventory,
  bow1: { ...inventory.bow1, EquippedSlot: { CharacterID: "Archer", SlotID: "Weapon" } },
}, defs);
assert.deepEqual(availableGear(archerWearsBow).map((item) => item.instanceID).sort(), ["staff1", "sword1"],
  "gear equipped by another hero is unavailable in the shared bag");
assert.equal(availableGear(ownedGear({ ...inventory,
  boots1: { ...inventory.boots1, EquippedSlot: null },
}, defs)).length, 4, "unequipping returns the exact instance to the bag");
assert.equal(equippedIn(ownedGear(JSON.parse(JSON.stringify(inventory)), defs), "Knight", "Boots")?.instanceID,
  "boots1", "equipment assignment restores from iDos inventory state");
assert.deepEqual(totalBonuses(items, "Knight"), { attack: 0, maxHp: 0, defence: 0, attackSpeed: 0, moveSpeed: 15 });
assert.equal(compareGear({ ...boots, bonuses: { ...boots.bonuses, moveSpeed: 20 } }, boots).moveSpeed, 5);
assert.equal(gearBonuses(defs.get("sword")).attack, 12);

const base = { maxHp: 120, damage: 10, armor: 0, attackSpeed: 1,
  critChance: 0, critMultiplier: 1.5, dodge: 0, regen: 0, multiShot: 0 };
const archetype = { moveSpeed: 65, attackRange: 0.13, cadence: 1, hit: 1 };
const naked = stageHeroStats(base, archetype, { attack: 0, maxHp: 0, defence: 0, attackSpeed: 0, moveSpeed: 0 });
const fast = stageHeroStats(base, archetype, totalBonuses(items, "Knight"));
const armed = stageHeroStats(base, archetype, { attack: 12, maxHp: 0, defence: 0, attackSpeed: 0, moveSpeed: 0 });
assert.equal(fast.moveSpeed, 80);
assert.equal(armed.attack, 22);
assert.ok(combatPower(fast) > combatPower(naked));
assert.ok(combatPower(armed) > combatPower(naked));

const travelStage = { id: "gear-travel", name: "Travel", length: 1000, encounters: [],
  boss: { id: "boss", distance: 1000, enemies: [{ type: "Dummy", maxHp: 500,
    attack: 0, defence: 0, attackSpeed: 0.1, moveSpeed: 0, attackRange: 0.1 }] } };
const source = (stats) => ({ id: "Knight", classId: "Warrior", level: 1, ...stats });
const solo = (stats) => [{ index: 1, unlocked: true, hero: source(stats) },
  { index: 2, unlocked: false, hero: null }, { index: 3, unlocked: false, hero: null }];
const elapsed = (stats) => {
  const run = new StageRun(travelStage);
  run.setSlots(solo(stats));
  run.start();
  let arrival = null;
  for (let i = 0; i < 12000 && run.state !== "clear"; i++) {
    run.tick(1 / 60);
    if (run.state === "boss" && arrival === null) arrival = run.elapsedSeconds;
  }
  assert.equal(run.state, "clear");
  return { arrival, clear: run.completionSeconds };
};
const slowRun = elapsed(naked);
const bootsRun = elapsed(fast);
const swordRun = elapsed(armed);
assert.ok(bootsRun.arrival < slowRun.arrival, "Boots reduce actual travel time");
assert.ok(swordRun.clear - swordRun.arrival < slowRun.clear - slowRun.arrival,
  "a stronger weapon reduces actual combat time");
const snapshot = new StageRun(travelStage);
const mutableParty = solo(naked);
snapshot.setSlots(mutableParty);
snapshot.start();
const beforeAttack = snapshot.heroes[0].attack;
mutableParty[0].hero.attack = 999;
assert.equal(snapshot.heroes[0].attack, beforeAttack, "run keeps its start-time stat snapshot");

console.log("Equipment compatibility, persistence model, stat pipeline, power and stage timing passed");
