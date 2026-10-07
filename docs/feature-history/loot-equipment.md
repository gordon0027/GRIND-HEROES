# Loot and equipment V1

Continuous farming now queues equipment and formation changes made during a run.
The server change happens after the current run closes and before the next starts,
so the active run's fighter snapshot and party signature stay unchanged. Stage
chests accumulate as stackable inventory items and open one at a time from the
PLAY HUD through iDos Lootbox. DEV also has `boss_chest` and `boss_summon/boss`
for every fifth stage; see [stage progression](grind-stage.md).

The shared Inventory grid now shows only unequipped item instances across the
whole roster. Worn gear remains inspectable through its hero's equipment slot;
unequipping returns that same instance to the grid. The six-slot equipment
group is centered around the prepared hero UI portrait.

Inventory presentation fix (2026-10-07): the first open waits for an owned hero
to be present and derives its equipment, bag, and compatibility from the live
session snapshot. Empty Weapon and Offhand slots use the selected hero's class.
Owned item artwork uses the item's configured icon when present, then a known
item identity or its own class restriction; changing heroes never changes an
item's identity. Unequipped gear restricted to another hero stays inspectable
in the shared bag with a dark red marker and a disabled Equip action showing
the required hero. An open item detail stays open and recalculates on hero
switch. The existing server equip validation remains authoritative.

The six slots on each iDos Character definition are Helmet, Armor, Gloves,
Boots, Weapon and Offhand. Armor slots work for every hero. Weapon and Offhand
use `AllowedCharacterIDs`, so the iDos backend validates each class restriction.
The `idle-rpg` panel reads owned, unstackable Item instances from InventoryV2,
and `character.equipItems` / `unequipItems` persist the chosen instance and slot.
It displays rarity, item stats, and a comparison with the currently equipped item.
The three heroes use one gear model and one stage stat pipeline. Equipment changes
were originally blocked while a stage was active; the active run keeps a stat snapshot.

The DEV Title `98JRCAKG-DEV` contains five rarities and sixteen usable gear
definitions. Four old ring definitions remain as legacy, non-equippable items;
their old IDs are retained for player-data compatibility. `traveler_boots` adds
8 Move Speed, which changes travel time. Weapons add Damage, which changes
combat time. The local Party Power number is a display estimate; the iDos
Character Power field still drives the existing idle GOLD calculation.

V1 used direct Reward claims `grind_first_boots` and `grind_stage_chest`.
Stage Progression V2 closed those client-callable claims in DEV and moved the
grant into a validated CloudCode run. Every valid clear now grants GOLD and a
stackable `stage_chest`; the first validated Stage 1 clear also grants
`traveler_boots`. Lootbox `gear_summon` still has a `stage` price option that
consumes the chest and chooses from sixteen active gear definitions on iDos.
The existing 100 GEMS summons, `idle_gold`, GOLD and GEMS remain. See
[stage progression](grind-stage.md) for the validation and limitations.
No PROD configuration was changed.

## UI + Items Revamp V1 (2026-10-07)

The ten canonical equipment families now resolve to the 50 local PNGs under
`public/assets/ui/icons/<family>/`. `inventoryPresentation.ts` lists the five
art variants for each family. Known item IDs use their exact final image, so
the picture is stable when another hero is selected; an unfamiliar item ID
uses the family and rarity as a fallback. Empty slots still use the smaller
class-aware symbols. The DEV catalog's 16 usable equipment definitions have
matching IDs, rarity IDs and slots. Its four legacy rings stay excluded from
the six-slot equipment UI.

The gear normalization in `equipment.ts` derives `requiredLevel` from the
catalog rarity: Common 1, Uncommon 5, Rare 10, Epic 15, Legendary 20. This
uses the visible, stage-earned hero level from `grind_hero_xp_v1`; the item
instance's upgrade `Level` still controls stat scaling. Both class and level
checks run in `IdleSession.equipGear` before the SDK equip call, while the bag
keeps incompatible and locked items visible for inspection. Details list both
reasons when both checks fail. Equipped instances remain hidden from the
shared bag and available in their hero slots. The current iDos item catalog
has `Equipment.MinCharacterLevel: 0` on all 16 pieces; that server field checks
the separate paid Character rank, so setting it to these thresholds would
contradict the stage-XP level shown in this UI. The stage-level rule is enforced
by this game's client flow, not by a new server-side Character rule.
