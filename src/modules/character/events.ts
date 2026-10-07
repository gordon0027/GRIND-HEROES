import { defineTopic, shape } from "@idosgames/module-sdk";

// Topics this module EMITS. Declared in module.meta.json (`events.emits`) with the same descriptor,
// so other modules can copy it from the catalog — they never import this file.

/**
 * The hero the player plays with (Unity: CharactersSave.SelectedCharacterId — the hero a run is
 * launched with). Emitted once on start-up with the saved choice, and again whenever the player picks
 * another hero on the Heroes screen. A game listens to it to field that hero.
 */
export const heroSelected = defineTopic(
  "character:hero-selected@1",
  shape({ characterId: "string" }),
);
