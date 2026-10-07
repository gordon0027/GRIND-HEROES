# Item art direction

The user supplied three chest icons and the Knight, Archer, Mage portraits as
initial references on 2026-10-07. After reviewing generated swords, the user
explicitly selected the **five cartoon swords** as the canonical equipment-icon
style reference. Use the chests for chest artwork and the logo for overall mood;
do not use them to override the sword set's simplified equipment rendering.

The user's master prompt defines five-rarity equipment families. Each rarity is
a distinct item design, while scale, angle, outline thickness, lighting and
rendering style stay consistent within a family. The first realistic swords and
the first three generated shields were rejected as too realistic. Do not use
those shields as references or continue that set without restyling it.

## Visual rules

- One large, centered object per square icon, shown straight on or in a slight
  three-quarter view. Make its silhouette immediately readable at inventory size.
- Match the selected swords: graphic, almost vector-like fantasy cartoon art.
  Chunky silhouettes; a few large, clean color planes per material; soft cel
  shading; controlled gradients; broad bright highlights; only slight 3D volume.
  Avoid realistic material rendering, dense faceting, fine grain, numerous small
  rivets, complex reflections, painterly texture and excessive shine.
- Strong, nearly black outer contours and clear dark separations between parts.
- Saturated but controlled colors; warm gold for premium metal details. Materials
  should remain recognizable: wood, leather, iron, steel, crystal and dragon scale.
- Clean isolated object with room around its outline. Prefer a genuinely
  transparent background, with no scene, text, rarity frame or drop shadow baked
  into the icon. The game UI supplies the rarity frame.
- Keep the object readable at 48–64 px. Use broad features rather than tiny
  ornaments; even Legendary should remain uncluttered.
- For shields specifically, use the five swords' simplified rendering as the
  style reference, while following the shield brief's front-facing composition.
- Keep visual complexity and lighting consistent across all item families. Use
  rarity to guide material quality and ornament only where the item itself calls
  for it, without making duplicate color variants of the same item.

## Supplied references

**Canonical equipment style:** five files in
`C:/Users/BG/Downloads/GrindHeroes_Swords_Cartoon/` — `wooden_sword.png`,
`bronze_sword.png`, `iron_sword.png`, `runeblade.png`, `dragon_blade.png`.
The user reattached the matching generated images and explicitly said, “вот
этот стиль запомни”. Use these actual images as visual references for future
equipment generations; do not rely on text alone.

- `Polished Cartoon Treasure Chest Icon.png`: ordinary wood and silver chest.
- `Glossy Blue and Gold Treasure Chest.png`: vivid blue panels and bright gold trim.
- `Epic Purple Enchanted Treasure Chest.png`: purple crystal, gold trim, magical glow.
- Knight, Archer and Mage portrait PNGs: matching thick contours, chibi fantasy
  proportions, faceted shading and clear material/color separation.
- `gh_idos_logo (1).png`: overall palette and energetic fantasy presentation.

The reference files are outside the repository. If they are unavailable in a
later session, ask the user to attach them again. The current DEV audit found
16 distinct usable gear items plus two obtainable chest items; see
`loot-equipment.md` for system context.
