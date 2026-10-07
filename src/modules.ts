import type { Module } from "@idosgames/module-sdk";
import { characterModule } from "./modules/character";
import { inventoryModule } from "./modules/inventory";
import { lootboxesModule } from "./modules/lootboxes";
import { questsModule } from "./modules/quests";
import { storeModule } from "./modules/store";
import { idleRpgModule } from "./modules/idle-rpg";

// The modules this app is made of, on top of the base (./base — sign-in and the lobby): the systems
// shown as lobby tabs (shop, heroes, leaderboards…) and the games launched by "Play". Remove a module
// here and it is gone from the app. The platform writes this file whenever modules are installed or
// removed, so it holds only the imports and the array.
//
// Example, after copying a module into src/modules/voxelcraft/:
//   import { voxelcraftModule } from "./modules/voxelcraft";
//   export const modules: Module[] = [voxelcraftModule];
export const modules: Module[] = [
  characterModule,
  inventoryModule,
  lootboxesModule,
  questsModule,
  storeModule,
  idleRpgModule,
];
