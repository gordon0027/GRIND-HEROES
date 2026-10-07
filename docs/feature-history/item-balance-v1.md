# Item Balance V1 — DEV data and local release source (2026-10-07)
 
## Release state
 
The DEV Title `98JRCAKG-DEV` contains 50 equippable definitions, four retained legacy rings, six stackable chest IDs, and six Lootbox definitions. Only Item and Lootbox configuration was saved. The act-aware chest grant in local `stageRewards.js` and the matching two-button client routing are **not published** yet, because this request forbids a new client upload. DEV CloudCode remains revision 20 and still grants legacy chest IDs at every Act; its current build can open these through the Act 1 pools. Publishing the local CloudCode before the client would strand Act 2/3 chests on that build. The next DEV client deployment must publish the local CloudCode source together with the client.
 
## Why the previous balance failed
 
Both chests had the same 117-weight pool: Common 67.5%, Uncommon 14.5%, Rare 12.8%, Epic 3.4%, Legendary 1.7%. Lv20 gear could appear in the first Act. Existing weapons jumped 5→15→40→100 Damage, and armor 50→150→400→1000 HP. Only 16 of the intended 50 definitions existed; none of those had a final `AssetPaths.icon`. The new base weapon curve is 5/9/15/24/36. Armor is 40/65/95/135/190 HP plus 1/2/3/4/6 Defence. Each family keeps its slot identity. All 50 pieces now share a restrained +6% flat bonus per item upgrade level, up to item level 10. Stage distance, encounter density, movement, GOLD and Hero XP were not changed.
 
## Loot architecture and exact chances
 
Each clear grants one stackable chest. Milestone bosses (stages 5 and 10 in each Act) grant a second Boss Chest. The server chooses `stage_chest` / `boss_chest` for Act 1 and `*_act2` / `*_act3` for later Acts. Two visible buttons sum all owned variants. Opening spends one chest through its matching hidden Lootbox; the client prioritizes the highest Act stack. Old stacks keep their legacy IDs and use Act 1 pools. The 100-GEMS `gear_summon` option also uses the Act 1 pool. Every eligible family has equal weight within each rarity: universal 40%, Knight 20%, Archer 20%, Mage 20%. Duplicates remain possible.
 
| Chest pool | Common | Uncommon | Rare | Epic | Legendary | Mean rarity index |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Act 1 Stage | 78% | 20% | 2% | 0% | 0% | 0.240 |
| Act 1 Boss | 58% | 32% | 9% | 1% | 0% | 0.530 |
| Act 2 Stage | 22% | 52% | 23% | 3% | 0% | 1.070 |
| Act 2 Boss | 10% | 38% | 42% | 9.5% | 0.5% | 1.525 |
| Act 3 Stage | 8% | 25% | 48% | 18% | 1% | 1.790 |
| Act 3 Boss | 3% | 12% | 47% | 34% | 4% | 2.240 |
 
Mean rarity index treats Common=0 through Legendary=4. Boss pools have a higher chance at every available upper rarity threshold than the matching Stage pool. Act 1 Stage has no Epic or Legendary; Act 1 Boss has a 1% Epic chance and no Legendary. The earliest Legendary possibility is an Act 2 Boss at 0.5%. An Act 3 Boss has 4% Legendary chance, never a guarantee.
 
## Canonical 50-item matrix
 
Stats are flat base bonuses at item upgrade level 1. `Health` displays as Max HP, `Armor` as Defence. The required level is the stage-earned Hero Level, not iDos Character paid rank. “All six” means all six Act/chest pools; A1/A2/A3 are Acts 1/2/3.
 
| Item ID | Display name | Family | Slot | Hero | Rarity | Req Lv | Final stats | AssetPaths.icon | Eligible source |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `wooden_sword` | Wooden Sword | sword | Weapon | Knight | Common | 1 | Damage +5 | `assets/ui/icons/sword/wooden_sword.png` | All six |
| `bronze_sword` | Bronze Sword | sword | Weapon | Knight | Uncommon | 5 | Damage +9 | `assets/ui/icons/sword/bronze_sword.png` | All six |
| `iron_sword` | Iron Sword | sword | Weapon | Knight | Rare | 10 | Damage +15 | `assets/ui/icons/sword/iron_sword.png` | All six |
| `runeblade` | Runeblade | sword | Weapon | Knight | Epic | 15 | Damage +24 | `assets/ui/icons/sword/runeblade.png` | A1 Boss; A2–3 Stage/Boss |
| `dragon_blade` | Dragon Blade | sword | Weapon | Knight | Legendary | 20 | Damage +36 | `assets/ui/icons/sword/dragon_blade.png` | A2 Boss; A3 Stage/Boss |
| `oak_shield` | Oak Shield | shield | Offhand | Knight | Common | 1 | Health +25, Armor +2 | `assets/ui/icons/shield/oak_shield.png` | All six |
| `reinforced_shield` | Reinforced Shield | shield | Offhand | Knight | Uncommon | 5 | Health +40, Armor +3 | `assets/ui/icons/shield/reinforced_shield.png` | All six |
| `steel_bulwark` | Steel Bulwark | shield | Offhand | Knight | Rare | 10 | Health +60, Armor +4 | `assets/ui/icons/shield/steel_bulwark.png` | All six |
| `runic_aegis` | Runic Aegis | shield | Offhand | Knight | Epic | 15 | Health +85, Armor +6 | `assets/ui/icons/shield/runic_aegis.png` | A1 Boss; A2–3 Stage/Boss |
| `sunforge_aegis` | Sunforge Aegis | shield | Offhand | Knight | Legendary | 20 | Health +120, Armor +8 | `assets/ui/icons/shield/sunforge_aegis.png` | A2 Boss; A3 Stage/Boss |
| `leather_helmet` | Leather Helmet | helmet | Helmet | Any | Common | 1 | Health +20, Armor +1 | `assets/ui/icons/helmet/leather_helmet.png` | All six |
| `reinforced_helmet` | Reinforced Helmet | helmet | Helmet | Any | Uncommon | 5 | Health +32, Armor +2 | `assets/ui/icons/helmet/reinforced_helmet.png` | All six |
| `steel_helmet` | Steel Helmet | helmet | Helmet | Any | Rare | 10 | Health +45, Armor +3 | `assets/ui/icons/helmet/steel_helmet.png` | All six |
| `runic_helm` | Runic Helm | helmet | Helmet | Any | Epic | 15 | Health +65, Armor +4 | `assets/ui/icons/helmet/runic_helm.png` | A1 Boss; A2–3 Stage/Boss |
| `phoenix_helm` | Phoenix Helm | helmet | Helmet | Any | Legendary | 20 | Health +90, Armor +5 | `assets/ui/icons/helmet/phoenix_helm.png` | A2 Boss; A3 Stage/Boss |
| `leather_vest` | Leather Vest | armor | Armor | Any | Common | 1 | Health +40, Armor +1 | `assets/ui/icons/armor/leather_vest.png` | All six |
| `reinforced_vest` | Reinforced Vest | armor | Armor | Any | Uncommon | 5 | Health +65, Armor +2 | `assets/ui/icons/armor/reinforced_vest.png` | All six |
| `chainmail` | Chainmail | armor | Armor | Any | Rare | 10 | Health +95, Armor +3 | `assets/ui/icons/armor/chainmail.png` | All six |
| `knight_plate` | Knight Plate | armor | Armor | Any | Epic | 15 | Health +135, Armor +4 | `assets/ui/icons/armor/knight_plate.png` | A1 Boss; A2–3 Stage/Boss |
| `dragon_scale` | Dragon Scale | armor | Armor | Any | Legendary | 20 | Health +190, Armor +6 | `assets/ui/icons/armor/dragon_scale.png` | A2 Boss; A3 Stage/Boss |
| `worn_gloves` | Worn Gloves | gloves | Gloves | Any | Common | 1 | Damage +1, AttackSpeed +0.03 | `assets/ui/icons/gloves/worn_gloves.png` | All six |
| `training_gloves` | Training Gloves | gloves | Gloves | Any | Uncommon | 5 | Damage +2, AttackSpeed +0.05 | `assets/ui/icons/gloves/training_gloves.png` | All six |
| `steel_gauntlets` | Steel Gauntlets | gloves | Gloves | Any | Rare | 10 | Damage +3, AttackSpeed +0.07 | `assets/ui/icons/gloves/steel_gauntlets.png` | All six |
| `runebound_gloves` | Runebound Gloves | gloves | Gloves | Any | Epic | 15 | Damage +5, AttackSpeed +0.1 | `assets/ui/icons/gloves/runebound_gloves.png` | A1 Boss; A2–3 Stage/Boss |
| `titan_gauntlets` | Titan Gauntlets | gloves | Gloves | Any | Legendary | 20 | Damage +7, AttackSpeed +0.13 | `assets/ui/icons/gloves/titan_gauntlets.png` | A2 Boss; A3 Stage/Boss |
| `traveler_boots` | Traveler Boots | boots | Boots | Any | Common | 1 | MoveSpeed +5 | `assets/ui/icons/boots/traveler_boots.png` | All six |
| `scout_boots` | Scout Boots | boots | Boots | Any | Uncommon | 5 | MoveSpeed +8 | `assets/ui/icons/boots/scout_boots.png` | All six |
| `swift_boots` | Swift Boots | boots | Boots | Any | Rare | 10 | MoveSpeed +11 | `assets/ui/icons/boots/swift_boots.png` | All six |
| `windwalker_boots` | Windwalker Boots | boots | Boots | Any | Epic | 15 | MoveSpeed +14 | `assets/ui/icons/boots/windwalker_boots.png` | A1 Boss; A2–3 Stage/Boss |
| `stormstride_boots` | Stormstride Boots | boots | Boots | Any | Legendary | 20 | MoveSpeed +18 | `assets/ui/icons/boots/stormstride_boots.png` | A2 Boss; A3 Stage/Boss |
| `hunter_bow` | Hunter Bow | bow | Weapon | Archer | Common | 1 | Damage +5 | `assets/ui/icons/bow/hunter_bow.png` | All six |
| `recurve_bow` | Recurve Bow | bow | Weapon | Archer | Uncommon | 5 | Damage +9 | `assets/ui/icons/bow/recurve_bow.png` | All six |
| `silverwood_bow` | Silverwood Bow | bow | Weapon | Archer | Rare | 10 | Damage +15 | `assets/ui/icons/bow/silverwood_bow.png` | All six |
| `moonweave_bow` | Moonweave Bow | bow | Weapon | Archer | Epic | 15 | Damage +24 | `assets/ui/icons/bow/moonweave_bow.png` | A1 Boss; A2–3 Stage/Boss |
| `starfall_bow` | Starfall Bow | bow | Weapon | Archer | Legendary | 20 | Damage +36 | `assets/ui/icons/bow/starfall_bow.png` | A2 Boss; A3 Stage/Boss |
| `field_quiver` | Field Quiver | quiver | Offhand | Archer | Common | 1 | Damage +1, AttackSpeed +0.03 | `assets/ui/icons/quiver/field_quiver.png` | All six |
| `arrow_quiver` | Arrow Quiver | quiver | Offhand | Archer | Uncommon | 5 | Damage +2, AttackSpeed +0.05 | `assets/ui/icons/quiver/arrow_quiver.png` | All six |
| `steelhead_quiver` | Steelhead Quiver | quiver | Offhand | Archer | Rare | 10 | Damage +3, AttackSpeed +0.07 | `assets/ui/icons/quiver/steelhead_quiver.png` | All six |
| `stormshot_quiver` | Stormshot Quiver | quiver | Offhand | Archer | Epic | 15 | Damage +5, AttackSpeed +0.1 | `assets/ui/icons/quiver/stormshot_quiver.png` | A1 Boss; A2–3 Stage/Boss |
| `dragonflight_quiver` | Dragonflight Quiver | quiver | Offhand | Archer | Legendary | 20 | Damage +7, AttackSpeed +0.13 | `assets/ui/icons/quiver/dragonflight_quiver.png` | A2 Boss; A3 Stage/Boss |
| `apprentice_staff` | Apprentice Staff | staff | Weapon | Mage | Common | 1 | Damage +5 | `assets/ui/icons/staff/apprentice_staff.png` | All six |
| `ashwood_staff` | Ashwood Staff | staff | Weapon | Mage | Uncommon | 5 | Damage +9 | `assets/ui/icons/staff/ashwood_staff.png` | All six |
| `crystal_staff` | Crystal Staff | staff | Weapon | Mage | Rare | 10 | Damage +15 | `assets/ui/icons/staff/crystal_staff.png` | All six |
| `sapphire_staff` | Sapphire Staff | staff | Weapon | Mage | Epic | 15 | Damage +24 | `assets/ui/icons/staff/sapphire_staff.png` | A1 Boss; A2–3 Stage/Boss |
| `astral_staff` | Astral Staff | staff | Weapon | Mage | Legendary | 20 | Damage +36 | `assets/ui/icons/staff/astral_staff.png` | A2 Boss; A3 Stage/Boss |
| `apprentice_orb` | Apprentice Orb | orb | Offhand | Mage | Common | 1 | Damage +3 | `assets/ui/icons/orb/apprentice_orb.png` | All six |
| `focus_orb` | Focus Orb | orb | Offhand | Mage | Uncommon | 5 | Damage +5 | `assets/ui/icons/orb/focus_orb.png` | All six |
| `sapphire_orb` | Sapphire Orb | orb | Offhand | Mage | Rare | 10 | Damage +8 | `assets/ui/icons/orb/sapphire_orb.png` | All six |
| `runic_orb` | Runic Orb | orb | Offhand | Mage | Epic | 15 | Damage +12 | `assets/ui/icons/orb/runic_orb.png` | A1 Boss; A2–3 Stage/Boss |
| `celestial_orb` | Celestial Orb | orb | Offhand | Mage | Legendary | 20 | Damage +17 | `assets/ui/icons/orb/celestial_orb.png` | A2 Boss; A3 Stage/Boss |
 
## Hero level, economy and validation
 
The stage XP curve remains 25→170. A representative uninterrupted route with ~64s Act 1 clears, ~80s Act 2 and ~83s Act 3 reaches Lv5 at Stage 1-9 (~10 min, 9 Stage/1 Boss chests), Lv10 at 3-1 (~25 min, 21/4), Lv15 after three 3-10 repeats (~42 min, 33/9), and Lv20 after 19 repeats (~64 min, 49/25). This is a solo continuous-participation estimate, not a promise for a party: recruited heroes start their own XP record. Act 2 Rare and Act 3 Epic can arrive before equip eligibility and remain visible in Inventory.
 
Equip UI rejects Lv4→Lv5, Lv9→Lv10, Lv14→Lv15 and Lv19→Lv20, then permits each at the threshold; tests cover these cases. The iDos `Equipment.MinCharacterLevel` field governs the separate paid Character rank, so setting it to stage XP levels would enforce the wrong rule. The current level gate is in `IdleSession.equipGear`; direct calls to the underlying iDos Character API can bypass it. A server-side hook for stage-earned Hero XP would be needed before treating this gate as tamper-proof.
 
DEV `idle_gold` is 2 GOLD/s + 0.01 × strongest Character Power, accumulating for up to 8 hours. That is at least 120 GOLD/min and 57,600 GOLD per full offline cap. Stage-only GOLD is roughly 62/203/373 GOLD/min in Acts 1/2/3 for the representative durations. The idle base exceeds Act 1 stage income and eight offline hours exceed all four progression purchase prices combined (42,500 GOLD). This weakens active early farming incentives. No idle rate was changed in this pass; a candidate for the next economy review is 0.5 GOLD/s + 0.002 × Power, after measuring real Character Power distributions.
 
Actual DEV costs are Archer 2,500 GOLD, Mage 10,000, Slot 2 5,000, Slot 3 25,000. At zero Character Power and continuous active farming plus base idle income, approximate minutes to buy are:
 
| Cost | Act 1 | Act 2 | Act 3 | Idle only |
| --- | ---: | ---: | ---: | ---: |
| Archer 2,500 | 14 | 8 | 5 | 21 |
| Mage 10,000 | 55 | 31 | 20 | 83 |
| Slot 2 5,000 | 27 | 15 | 10 | 42 |
| Slot 3 25,000 | 137 | 77 | 51 | 208 |
 
These are isolated costs, with no spending on stat/item upgrades and no account starting balance. At Character Power 100, idle adds another 60 GOLD/min and each time falls further.
 
## Combat sanity
 
Representative simulation includes paid stat enhancement steps 0/3/8/14/20 by tier and full six-slot gear. Results are model outputs, not recorded player runs:
 
| Party | Stage | Result | Time | Party display Power |
| --- | --- | --- | ---: | ---: |
| Lv1 Knight / Common | 1-1 | Clear | 54s | 114 |
| Lv5 Knight+Archer / Uncommon | 1-10 | Clear | 64s | 314 |
| Lv10 trio / Rare | 2-10 | Clear | 81s | 749 |
| Lv15 trio / Epic | 3-5 | Clear | 80s | 1,035 |
| Lv20 trio / Legendary | 3-10 | Clear | 83s | 1,358 |
 
With the same paid enhancements held at eight steps, a full trio clears 3-5 in 93/90/85/83/78 seconds from Common through Legendary. End HP totals rise 854/1054/1223/1435/1713 and display Power rises 577/655/749/884/1056. Gear improves clear time and survivability, while travel sets a floor. The model uses fully equipped parties and no item upgrade levels. Rare gear with a fully enhanced trio can already clear late Act 3; this is a tuning concern before Marketplace, but stage pacing values were intentionally preserved.
 
## Checks and follow-up
 
The saved DEV Item catalog was read back and matched all intended fields; six Lootbox pools were read back with 10,000 integer weight each. A post-publication readback of DEV revision 21 confirmed all six canonical rarity distributions (78/20/2/0/0, 58/32/9/1/0, 22/52/23/3/0, 10/38/42/9.5/0.5, 8/25/48/18/1, and 3/12/47/34/4). Local Inventory showed updated names, level, icon, slot and stats (Chainmail: Rare, Lv10, +95 HP, +3 Defence). Local CloudCode tests check chest IDs by Act; local chest routing tests keep legacy stacks and never spend Act 3 chests through Act 1 pools. DEV client v30 and CloudCode revision 21 were staged together; a legacy Act 1 chest opened on the DEV guest with a visible item icon, name and rarity popup. Actual Act 2/3 clears and openings remain to be verified on a progressed DEV account. PROD was untouched. Evaluate the high idle rate and the client-only Hero Level equip gate before a Marketplace launch.
