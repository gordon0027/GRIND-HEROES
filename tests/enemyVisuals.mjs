import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ENEMY_VISUALS, enemyAnimationKey, registerEnemyAnimations } from
  "../src/modules/idle-rpg/phaser/enemyVisuals.ts";

const created = new Map();
const scene = { anims: {
  exists: (key) => created.has(key),
  generateFrameNumbers: (_key, range) => Array.from(
    { length: range.end - range.start + 1 }, (_, i) => range.start + i),
  create: (animation) => created.set(animation.key, animation),
} };

for (const [id, config] of Object.entries(ENEMY_VISUALS)) {
  const bytes = readFileSync(new URL(`../public${config.assetPath}`, import.meta.url));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const sizes = { ogreboss: [3600, 1040], orangeOgre: [3768, 1044], zombieOgre: [3768, 1040] };
  assert.deepEqual([width, height], sizes[id] ?? [3072, 1024]);
  assert.equal(width / config.frameWidth, 12);
  assert.equal(height / config.frameHeight, 4);
  assert.equal(config.originX, 0.5);
  for (const [row, motion] of ["idle", "run", "attack", "death"].entries()) {
    const sequence = config.frames[motion];
    assert.equal(sequence.start, row * 12);
    assert.equal(sequence.end, row * 12 + 11);
  }
  assert.equal(config.frames.run.repeat, -1, `${id} walk loops indefinitely`);
  assert.equal(config.frames.attack.repeat, 0, `${id} attack plays once`);
  assert.equal(config.frames.death.repeat, 0, `${id} death plays once`);
  assert.ok(config.scale > 0);
  assert.ok(enemyAnimationKey(id, "attack").includes(id));
}
assert.equal(ENEMY_VISUALS.ogreboss.scale, 1,
  "the ogre stays at native size rather than being enlarged and blurred");
registerEnemyAnimations(scene);
assert.equal(created.size, Object.keys(ENEMY_VISUALS).length * 4);
for (const animation of created.values()) assert.equal(animation.frames.length, 12);
console.log("Act 1-3 enemy PNG grids and animation frame mappings passed");
