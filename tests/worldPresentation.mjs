import assert from "node:assert/strict";
import { FIRST_STAGE, StageRun } from "../src/modules/idle-rpg/game/stageRun.ts";
import { CAMERA_MAX_METRES_PER_SECOND, PIXELS_PER_WORLD_METRE,
  DESKTOP_CAMERA_RIGHT_PX, WorldPresentation, projectWorldX
} from "../src/modules/idle-rpg/game/worldPresentation.ts";

const knight = { id: "Knight", classId: "Warrior", level: 1, maxHp: 120,
  attack: 10, defence: 0, attackSpeed: 1, moveSpeed: 70, attackRange: 0.13,
  combatType: "MELEE", projectile: null };
const archer = { ...knight, id: "Archer", classId: "Ranger", moveSpeed: 75,
  attackRange: 0.38, combatType: "RANGED",
  projectile: { type: "ARROW", speed: 1.5, releaseDelay: 0.18 } };
const mage = { ...knight, id: "Mage", classId: "Mage", moveSpeed: 60,
  attackRange: 0.32, combatType: "RANGED",
  projectile: { type: "MAGIC_ORB", speed: 1.1, releaseDelay: 0.18 } };
const widths = [390, 768, 1280, 1920];
const step = 1 / 60;

for (const members of [[knight], [knight, archer, mage]]) {
  const run = new StageRun(FIRST_STAGE);
  run.setSlots([1, 2, 3].map((index) => ({ index,
    unlocked: index <= members.length, hero: members[index - 1] ?? null })));
  const world = new WorldPresentation();
  world.update(run, 0);
  assert.equal(run.start(), true);
  world.reset();
  world.update(run, 0);
  const entrances = [];
  let sawVisibleBackline = false;
  let lastPreview = [];
  let lastState = run.state;
  for (let frame = 0; frame < 6000 && run.state !== "clear" && run.state !== "failed"; frame++) {
    const oldWorld = new Map(run.heroes.map((hero) => [hero.id, world.heroWorldX(hero.id)]));
    const oldEnemies = new Map(run.enemies.map((enemy) =>
      [enemy.id, world.enemyWorldX(enemy.id)]));
    const oldCamera = world.cameraWorldX;
    const beforeDistance = run.distance;
    lastPreview = world.visibleEnemies(run);
    const events = run.tick(step);
    const distanceAfterTick = run.distance;
    world.update(run, step);
    if (members.length > 1 && (run.state === "encounter" || run.state === "boss")) {
      const gap = world.heroWorldX("Knight") - world.heroWorldX("Archer");
      if (gap >= 10) sawVisibleBackline = true;
    }
    assert.equal(run.distance, distanceAfterTick, "presentation cannot change stage progress");
    assert.ok(run.distance >= beforeDistance, "stage progress stays monotonic");
    for (const hero of run.heroes) {
      const moved = world.heroWorldX(hero.id) - oldWorld.get(hero.id);
      const retreatBound = hero.combatType === "RANGED" &&
        (lastState === "encounter" || lastState === "boss")
        ? -hero.moveSpeed * step - 1e-6 : -1e-7;
      assert.ok(moved >= retreatBound && moved <= hero.moveSpeed * 1.46 * step + 1e-6,
        `${members.length} heroes: ${hero.id} jumped ${moved}m on ${lastState} → ${run.state}`);
    }
    for (const enemy of run.enemies) {
      if (!oldEnemies.has(enemy.id)) continue;
      const moved = world.enemyWorldX(enemy.id) - oldEnemies.get(enemy.id);
      assert.ok(Math.abs(moved) <= enemy.moveSpeed * 250 * step + 1e-6,
        `enemy ${enemy.id} jumped ${moved}m on ${lastState} → ${run.state}`);
    }
    assert.ok(Math.abs(world.cameraWorldX - oldCamera) <=
      CAMERA_MAX_METRES_PER_SECOND * step + 1e-7,
    `camera jumped on ${lastState} → ${run.state}`);

    for (const event of events) {
      if (event.type !== "encounterStarted") continue;
      entrances.push(event.id);
      const active = world.visibleEnemies(run);
      assert.equal(active.length, lastPreview.length,
        "the visible upcoming enemies become the same active encounter");
      for (let i = 0; i < active.length; i++)
        assert.ok(Math.abs(active[i].worldX - lastPreview[i].worldX) < 1e-7,
          "enemy stays on the same world coordinate when combat starts");
      const front = Math.max(...run.heroes.filter((hero) => hero.alive)
        .map((hero) => world.heroWorldX(hero.id)));
      for (const width of widths) {
        const gap = projectWorldX(active[0].worldX, world.cameraWorldX, width) -
          projectWorldX(front, world.cameraWorldX, width);
        assert.ok(gap > 0 && gap < 250,
          `${width}px: encounter stays ahead of the party and visually compact`);
      }
    }

    // A viewport change changes only the anchor, never world spacing or camera state.
    const front = Math.max(...run.heroes.filter((hero) => hero.alive)
      .map((hero) => world.heroWorldX(hero.id)));
    const cameraBeforeResize = world.cameraWorldX;
    const partyBeforeResize = run.heroes.map((hero) => world.heroWorldX(hero.id));
    for (const width of widths) {
      const projected = projectWorldX(front, world.cameraWorldX, width);
      assert.ok(Math.abs(projected - width * .36 -
        (front - world.cameraWorldX) * PIXELS_PER_WORLD_METRE) < 1e-7);
    }
    assert.equal(world.cameraWorldX, cameraBeforeResize,
      "viewport projection cannot alter the camera");
    assert.deepEqual(run.heroes.map((hero) => world.heroWorldX(hero.id)),
      partyBeforeResize, "viewport projection cannot move heroes");
    lastState = run.state;
  }
  assert.equal(run.state, "clear", `${members.length} heroes clear Stage 1 through the boss`);
  assert.deepEqual(entrances, [...FIRST_STAGE.encounters, FIRST_STAGE.boss].map((e) => e.id));
  assert.ok(world.cameraWorldX > 100, "the camera follows the party through the stage");
  if (members.length > 1)
    assert.ok(sawVisibleBackline, "the ranged hero visibly stays behind the Knight in combat");
  assert.ok(world.heroWorldX("Knight") > 900, "heroes occupy persistent world coordinates");
}

console.log("World positions, preview-to-combat continuity, camera bounds, 390/768/1280/1920 projection and 1/3-hero boss clears passed");

// Reproduce the reported desktop failure over whole runs: after clears 2/3/4,
// a forward-running Knight must not slide left while the camera catches up.
for (const members of [[knight], [knight, archer, mage]]) {
  for (const width of [390, 1280, 1440, 1920]) {
    const run = new StageRun(FIRST_STAGE);
    run.setSlots([1, 2, 3].map((index) => ({ index,
      unlocked: index <= members.length, hero: members[index - 1] ?? null })));
    run.start();
    const world = new WorldPresentation();
    world.update(run, 0, width);
    let afterClear = null;
    const checkedClears = new Set();
    let maxDesktopOffset = 0;
    for (let frame = 0; frame < 6000 && run.state !== "clear" && run.state !== "failed"; frame++) {
      const oldCamera = world.cameraWorldX;
      const oldKnightWorld = world.heroWorldX("Knight");
      const oldKnightScreen = projectWorldX(oldKnightWorld, oldCamera, width);
      const events = run.tick(step);
      world.update(run, step, width);
      const knightWorld = world.heroWorldX("Knight");
      const knightScreen = projectWorldX(knightWorld, world.cameraWorldX, width);
      assert.ok(world.cameraWorldX >= oldCamera - 1e-8,
        `${width}px: forward run moved the camera backwards`);
      assert.ok(Math.abs(knightScreen - oldKnightScreen) < 5,
        `${width}px: the camera snapped Knight on screen`);
      if (width >= 1280) {
        const offset = knightScreen - width * .36;
        maxDesktopOffset = Math.max(maxDesktopOffset, offset);
        assert.ok(offset <= DESKTOP_CAMERA_RIGHT_PX + 1e-6,
          `${width}px: Knight crossed the fixed desktop camera zone`);
      }
      if (afterClear && run.state === "running") {
        assert.ok(knightScreen >= afterClear.screenX - .1,
          `${width}px: Knight slid left after ${afterClear.id} while running`);
        afterClear.screenX = knightScreen;
        if (++afterClear.frames === 60) {
          checkedClears.add(afterClear.id);
          afterClear = null;
        }
      }
      for (const event of events) {
        if (event.type === "encounterCleared" &&
            ["meadow-2", "meadow-3", "meadow-4"].includes(event.id))
          afterClear = { id: event.id, screenX: knightScreen, frames: 0 };
      }
    }
    assert.equal(run.state, "clear", `${width}px: Stage 1 completes`);
    assert.deepEqual(checkedClears, new Set(["meadow-2", "meadow-3", "meadow-4"]));
    if (width >= 1280) assert.ok(maxDesktopOffset > DESKTOP_CAMERA_RIGHT_PX - 2,
      `${width}px: the background takes over travel at the dead-zone edge`);
  }
}

console.log("Desktop 1280/1440/1920 dead-zone and post-clear stability, mobile 390 regression, camera monotonicity passed");

const resizedRun = new StageRun(FIRST_STAGE);
resizedRun.setSlots([1, 2, 3].map((index) => ({ index,
  unlocked: index <= 3, hero: [knight, archer, mage][index - 1] })));
resizedRun.start();
const resizedWorld = new WorldPresentation();
resizedWorld.update(resizedRun, 0, 390);
for (let i = 0; i < 400; i++) {
  resizedRun.tick(step);
  resizedWorld.update(resizedRun, step, 390);
}
const beforeResize = resizedRun.heroes.map((hero) => resizedWorld.heroWorldX(hero.id));
const beforeCameraResize = resizedWorld.cameraWorldX;
for (const width of [1920, 1280, 390]) {
  resizedWorld.update(resizedRun, 0, width);
  assert.deepEqual(resizedRun.heroes.map((hero) => resizedWorld.heroWorldX(hero.id)),
    beforeResize, `${width}px resize cannot move world positions`);
  assert.equal(resizedWorld.cameraWorldX, beforeCameraResize,
    `${width}px resize cannot instantly correct the camera`);
}
resizedRun.tick(step);
resizedWorld.update(resizedRun, step, 1920);
assert.ok(resizedWorld.cameraWorldX >= beforeCameraResize - 1e-8 &&
  resizedWorld.cameraWorldX - beforeCameraResize <= CAMERA_MAX_METRES_PER_SECOND * step + 1e-8,
"the first camera frame after resize stays forward and speed-bounded");

console.log("Mid-run desktop/mobile resize leaves hero world positions and camera unchanged");

const liveRun = new StageRun(FIRST_STAGE);
const liveSlots = (members) => [1, 2, 3].map((index) => ({ index,
  unlocked: index <= members.length, hero: members[index - 1] ?? null }));
liveRun.setSlots(liveSlots([knight]));
liveRun.start();
const liveWorld = new WorldPresentation();
liveWorld.update(liveRun, 0, 1280);
for (let i = 0; i < 120; i++) { liveRun.tick(step); liveWorld.update(liveRun, step, 1280); }
const knightWorld = liveWorld.heroWorldX("Knight");
const liveCamera = liveWorld.cameraWorldX;
const liveDistance = liveRun.distance;
liveRun.setSlots(liveSlots([knight, archer]));
liveWorld.update(liveRun, 0, 1280);
assert.equal(liveWorld.heroWorldX("Knight"), knightWorld, "joining hero cannot move the existing actor");
assert.equal(liveWorld.cameraWorldX, liveCamera, "joining hero cannot reset the camera");
assert.equal(liveRun.distance, liveDistance, "joining hero cannot reset stage distance");
const archerWorld = liveWorld.heroWorldX("Archer");
assert.ok(archerWorld <= knightWorld && archerWorld >= knightWorld - 30,
  "new actor enters near the current party rear");
liveRun.setSlots(liveSlots([knight]));
liveWorld.update(liveRun, 0, 1280);
for (let i = 0; i < 120; i++) { liveRun.tick(step); liveWorld.update(liveRun, step, 1280); }
const returnFront = liveWorld.heroWorldX("Knight");
const returnCamera = liveWorld.cameraWorldX;
liveRun.setSlots(liveSlots([knight, archer]));
liveWorld.update(liveRun, 0, 1280);
assert.equal(liveWorld.heroWorldX("Archer"), returnFront - 30,
  "living bench return enters at today's party rear");
assert.equal(liveWorld.heroWorldX("Knight"), returnFront);
assert.equal(liveWorld.cameraWorldX, returnCamera);
console.log("Live formation keeps actor positions, camera and stage distance");
