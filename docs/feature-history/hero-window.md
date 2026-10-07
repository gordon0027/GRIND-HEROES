# UI foundation V2

## Hero card polish and stats overlay V1 (2026-10-07)

The Inventory hero portrait has a fixed internal layout so its stage-XP bar
stays within the portrait frame at desktop and mobile widths. A small info
button opens a compact stats dialog for the selected hero. Its Attack, Defence,
Max HP, Attack Speed, Move Speed and Attack Range come from the same effective
stage-combat stat pipeline as the displayed Power, including equipped gear.
The dialog and card reflect session refreshes for gear and stage XP; the dialog
closes by its button, Escape or clicking the backdrop.

## UI + Items Revamp V1 (2026-10-07)

Inventory keeps its central hero portrait and six slots. The portrait, level,
power and stage-XP bar sit together within the card; slots align symmetrically
around it. At desktop width the bag and details sit beside the hero, while
smaller widths stack them. Team and Inventory retain separate footer buttons
and use the same panel, button and selection vocabulary. The bag's frames
indicate Common through Legendary, and a red badge marks class-incompatible
or level-locked pieces. Item details show the exact requirements.

The curated copies below came from
`C:/Users/BG/Documents/GitHub/Surv-Mobile/Assets/GUI Pro-FantasyRPG/ResourcesData/Sprites/Component/`.
The source folder was read only; runtime uses the copies in this project.

| Source PNG (relative to Component) | Grind Heroes copy | Use |
| --- | --- | --- |
| `Frame/frame_itemframe_02_frame_brown1.png` | `public/assets/ui/revamp/slots/base.png` | Equipment and bag slot base |
| `Frame/frame_itemframe_00_s1.png` | `public/assets/ui/revamp/slots/selected.png` | Selected item outline |
| `Frame/frame_itemframe_00_frame_yellow.png` | `public/assets/ui/revamp/rarity/common.png` | Neutralized steel Common edge |
| `Frame/frame_itemframe_00_frame_green.png` | `public/assets/ui/revamp/rarity/uncommon.png` | Uncommon edge |
| `Frame/frame_itemframe_00_frame_blue.png` | `public/assets/ui/revamp/rarity/rare.png` | Rare edge |
| `Frame/frame_itemframe_00_frame_purple.png` | `public/assets/ui/revamp/rarity/epic.png` | Epic edge |
| `Frame/frame_itemframe_00_frame_gold.png` | `public/assets/ui/revamp/rarity/legendary.png` | Legendary edge |

The old generic item symbols remain for empty slot hints only. The filled
pieces use the final item art, while rarity remains in the UI frame.

The former Heroes popup combined Inventory and Formation under two tabs. The footer now has four sections: PLAY, INVENTORY, TEAM, MORE; Stage Map lives inside PLAY. The footer is rendered once in `GamePanel`; the idle-rpg game frame provides balances and account controls but no second footer. Changing sections leaves the Phaser scene and `IdleSession` mounted, so an active run continues.

`ManagementSections.tsx` reuses the V1 equipment and formation actions (`IdleSession.equipGear`, `unequipGear`, `assignHero`) and their iDos persistence. Inventory owns hero selection, six equipment slots, shared item grid, comparison and equip controls. Team owns three party slots, locks and hero roster. Their selection state is local UI state; durable gear and party state remains in the session/server. The technical inventory and character lobby tabs are hidden from the primary game navigation. Hero rank upgrades remain available under MORE.

The large Inventory and Team panels share a dark steel frame (`Frame/frame_cardframe_02_front.png`) scaled with CSS `border-image`; item slots retain the brown fantasy slot sprites and gold selected outline. The four footer icons come from one function-icon family, with dark idle and brown selected buttons. The purple `popup_01_frame.png` from V1 was retired because its narrow proportions did not scale well as a full management panel.
