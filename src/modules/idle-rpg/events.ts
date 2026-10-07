import { defineTopic, shape } from "@idosgames/module-sdk";

// Topics this module EMITS. Declared in module.meta.json (`events.emits`) with the same descriptor,
// so other modules can copy it from the catalog — they never import this file.

/** A hero's level went up (after a successful `client.character.upgradeCharacterLevel`). */
export const characterUpgraded = defineTopic(
  "idle-rpg:character-upgraded@1",
  shape({ characterId: "string", level: "number" }),
);

/** The hero beat a stage's boss: `chapter`-`stage` is the stage just cleared ("3-6"). */
export const stageCleared = defineTopic(
  "idle-rpg:stage-cleared@1",
  shape({ chapter: "number", stage: "number" }),
);

// Topics this module LISTENS to — its own copy of the emitter's descriptor (from the catalog), with
// only the fields it reads. Optional: without the Heroes system the strongest hero fights.

/** The Heroes screen's selected hero (`modules/character`). */
export const heroSelected = defineTopic(
  "character:hero-selected@1",
  shape({ characterId: "string" }),
);
