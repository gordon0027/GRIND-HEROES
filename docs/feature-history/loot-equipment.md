# Loot and equipment V1

The current 50-item DEV catalog and six Act-specific Lootbox tables are recorded
in [Item Balance V1](item-balance-v1.md). The audit below describes the earlier
16-item configuration and is retained as change history.

## Balance audit pending Title configuration (2026-10-07)

The DEV Title has 16 equippable items and two manual chest lootboxes. Both
lootboxes currently use the exact same 117-weight pool: Common 79 (67.5%),
Uncommon 17 (14.5%), Rare 15 (12.8%), Epic 4 (3.4%), Legendary 2 (1.7%).
Consequently the Boss Chest has no quality advantage, and Lv20 items can
appear during Act 1. No local source can change these backend rolls: items
and lootbox pools live in the DEV Title configuration. This local-only pass
does not modify or publish that configuration. Before the next DEV release,
give the Boss Chest a separate higher-tier weighted pool and reduce early
Legendary access. Stage/Act-biased drops require additional Title lootbox
definitions and matching chest items; keep the current manual-open flow.
For the existing two-pool setup, a review target is Stage Chest rarity weights
70/20/8/1.5/0.5% and Boss Chest 50/27/17/5/1% from Common through Legendary.
These are proposed Title values, not current drop rates. A true Act-specific
curve would need three Stage Chest and three Boss Chest pool identities, with
Act 1 excluding Legendary, Act 2 making Rare realistic, and Act 3 making
Epic possible without flooding it. That change remains outside this local
numeric pass because the Title entities are not present in this repository.

Current weapon Damage jumps 5 Common → 15 Rare → 40 Epic → 100 Legendary;
armor Health jumps 50 → 150 → 400 → 1000. There is no Uncommon weapon or
armor. These steps are powerful but uneven, so the local combat pass keeps
the live item stats unchanged. A complete tier rebalance must update the
Title Item definitions together with lootbox weights and then rerun the
stage simulations against those exact values. The Lv1/5/10/15/20 equip
gates remain unchanged.

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

## Server-authoritative level audit (2026-10-07)

The equipment mutation boundary is the platform's native Character
`EquipItems` action. `IdleSession.equipGear`, the generic Character screen's
individual Equip and Equip Best actions, and any direct SDK/API caller can all
reach it. Inventory's Equip button only opens the Character screen. The native
action validates ownership, allowed slot, allowed character and its own paid
`Character.Level`; CloudCode handlers are separate callable actions and are
not pre-commit hooks for `EquipItems`. The available Item rule
`Equipment.MinCharacterLevel` reads paid Character rank, not the stage-earned
`grind_hero_xp_v1` ReadOnly record. Setting that field to Grind thresholds
would enforce the wrong progression track.

An opt-in DEV guest probe in `tests/manualDevEquipmentBypass.mjs` calls the
native SDK action directly. It confirmed invalid slot and unowned instance
rejection, valid Common equipment acceptance, and wrong-class rejection.
Critically, the native action **accepted and persisted** an Uncommon
`reinforced_shield` (required Grind Lv5) on a Knight whose protected Grind
level was 1. This reproduces the bypass without using the game UI. The
existing Lv4/5, 9/10, 14/15 and 19/20 tests exercise only the client helper.

The V1 server-authoritative equip requirement remains unimplemented. It
requires a platform-side pre-commit validator on every native equipment
mutation route, especially `EquipItems` with an instance ID or auto-picked
ItemID and batched Equip Best. That validator must read the protected Grind
level and trusted Item definition, resolve the owned instance and character,
check slot/class/level, and reject before persisting either Character or
InventoryV2. Native skin auto-equip/equip routes need the same audit if a
future skin carries Grind equipment requirements. A callable CloudCode
`validateEquip` preceding native `EquipItems` would remain bypassable and
would not provide this guarantee. No DEV configuration or CloudCode revision
was changed in this audit, and PROD was untouched.

## Authoritative Equipment State V2 (DEV, 2026-10-07)

`grind_equipment_v1` is a permanent ReadOnly UserCustomData JSON record. Its
`heroes` map holds exact item-instance IDs (or null) for Knight, Archer and
Mage across Helmet, Armor, Gloves, Boots, Weapon and Offhand. The same record
stores a trusted item-ID/catalog/level snapshot for each assigned instance.
Only CloudCode writes it. Grind combat stats, displayed Power, equipment
slots, the shared bag exclusion and stage equipment signatures derive from
this record. Native `Character.Power` is excluded from hero selection and
Grind stat calculations. DEV `idle_gold.Rate.PowerCoefficient` is 0, since
the platform's idle GOLD reward would otherwise still reward native Power
increases after a direct bypass. This deliberately makes idle GOLD use its
base rate; stage GOLD rewards are unchanged.

On first access, the server checks native Character equipment and imports
only valid, owned, class/slot-compatible instances meeting the protected
`grind_hero_xp_v1` level. Once the record exists, native equipment is never
re-imported. An invalid or missing saved record resets to empty rather than
reopening migration. Missing definitions or depleted item counts clear stale
assignments. No item is deleted by migration or cleanup.

On this DEV platform, CloudCode `ReadUserData(["InventoryV2"])` exposes
`Items[itemID].UnstackableAmount` but returns an empty `UnstackableItems`
instance map even when the player's inventory contains gear. The V2 equip
flow therefore calls native `Character.EquipItems` first as an ownership and
exact-instance attestation. Native iDos validates the owned instance, class
and slot; CloudCode then independently matches the exact instance ID and
trusted Item definition to that server-readable Character assignment,
checks aggregate ownership count, and checks the protected Grind level.
The native write alone grants no Grind effect. A failed CloudCode validation
leaves the protected state unchanged even if the native write succeeded.
The client forwards the native response's confirmed instance ID because
native equip can split an inventory instance. It reuses an already native
equipped instance as the attestation on retry.

`equipGrindItem` atomically replaces one protected slot; `unequipGrindItem`
removes one reference and leaves the item owned. Equip Best proposes eligible
instances from the local inventory, attests them in one native call, and
`equipBestGrindHero` revalidates every proposed slot before one protected
record write. It rejects the whole batch on an invalid candidate. The
server's `isGrindEquipped(itemInstanceID)` checks a specific protected
instance for future Marketplace listing rules. Marketplace itself is not
implemented here. Native mirroring beyond the required attestation is
unnecessary; Grind unequip does not need to mutate native equipment.

The opt-in `tests/manualDevEquipmentBypass.mjs` reproduced a direct native
Lv5 equip on a Grind Lv1 Knight after V2: native accepted and persisted it,
but the protected slots and Grind Power remained unchanged, the item stayed
visible in the Grind bag, and `isGrindEquipped` returned false. A Common
Traveler Boots equip through the protected operation changed Grind Power.
Unit tests cover Lv4/5, 9/10, 14/15, 19/20, class, slot, ownership,
replacement, unequip, Equip Best, duplicate instance IDs and stale cleanup.

Platform limitation: CloudCode cannot read the exact live unstackable
inventory map. Saved assignments use their server-attested snapshot and
aggregate per-item counts for later cleanup. If an external native route
deletes one of several identical instances without consulting
`isGrindEquipped`, the server cannot identify which instance disappeared.
Future Marketplace code must call the protected helper before listing and
reject an equipped instance. Concurrent CloudCode record writes also have
no exposed per-user compare-and-swap primitive, so simultaneous equip
requests may be last-write-wins; each individual write is a complete record.

DEV CloudCode revision 28 runs the attested V2 handlers. The DEV
UserCustomData schema registers `grind_equipment_v1` as ReadOnly JSON with
a 4096-byte limit. The verified client is staged as DEV test version 33
with `deploy:false`. No PROD configuration or build was changed.
