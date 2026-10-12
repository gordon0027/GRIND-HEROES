import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { hitProfile, visualRecoil, FeedbackThrottle, petAttackLunge } from "../src/modules/idle-rpg/game/hitFeedback.ts";
import { COMBAT_SKILLS } from "../src/modules/idle-rpg/game/combatSkills.ts";

const normal = hitProfile("ARROW", undefined, false);
const heavy = hitProfile("MELEE", COMBAT_SKILLS.Knight.id, false);
const boss = hitProfile("MELEE", COMBAT_SKILLS.Knight.id, true);
assert.equal(normal.holdMs, 0, "rapid arrows never request hit-stop");
assert.equal(heavy.holdMs, 55);
assert.equal(hitProfile("METEOR_FIREBALL", COMBAT_SKILLS.Mage.id, false).holdMs, 50);
assert.ok(visualRecoil(0, heavy) > visualRecoil(0, normal));
assert.equal(visualRecoil(heavy.recoilMs, heavy), 0, "no permanent displacement");
assert.equal(visualRecoil(0, boss), 0, "bosses never recoil");
const throttle = new FeedbackThrottle();
assert.equal(throttle.take(0, 160), true);
assert.equal(throttle.take(0, 160), false);
assert.equal(throttle.take(159, 160), false);
assert.equal(throttle.take(160, 160), true);
assert.equal(petAttackLunge(24), 0);
assert.ok(petAttackLunge(28) > 0);
assert.equal(petAttackLunge(35), 0);

// Exercise the real presentation controller with a tiny renderer adapter, no DOM/WebGL.
const url = new URL("../src/modules/idle-rpg/phaser/CombatJuice.ts", import.meta.url);
let source = readFileSync(url, "utf8").replace('import Phaser from "phaser";',
  'const Phaser = { TintModes: { FILL: 1 } };');
for (const file of ["hitFeedback", "worldPresentation"]) source = source.replace(
  `"../game/${file}"`, JSON.stringify(new URL(`../src/modules/idle-rpg/game/${file}.ts`, import.meta.url).href));
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext } }).outputText;
const { CombatJuice } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const tweens = new Map();
const object = () => ({ active: true, anims: { timeScale: 1.7 },
  setOrigin() { return this; }, setDepth() { return this; }, setPosition() { return this; },
  setTint() { return this; }, setTintMode() { return this; }, clearTint() { return this; },
  destroy() { this.active = false; } });
let shakes = 0;
const scene = { add: { text: object }, cameras: { main: { shake: () => shakes++ } },
  tweens: { add: (config) => { tweens.set(config.targets, config); },
    killTweensOf: (target) => tweens.delete(target) } };
const juice = new CombatJuice(scene);
const sprite = object();
juice.beginFrame(0);
juice.hold([sprite], 55);
juice.endFrame();
assert.equal(sprite.anims.timeScale, 0);
juice.beginFrame(20);
assert.equal(sprite.anims.timeScale, 1.7, "restore intended playback before scene updates");
juice.hold([sprite], 55); // repeated impact must not extend the original hold
juice.endFrame();
juice.beginFrame(56);
juice.endFrame();
assert.equal(sprite.anims.timeScale, 1.7, "visual hold expires without stacking");
juice.hit("boss:1", boss, 1);
assert.equal(juice.apply(sprite, "boss:1"), 0);
juice.shake(true); juice.shake(true);
assert.equal(shakes, 1);
for (let i = 0; i < 30; i++) juice.number(10, -60, 7, 0xffffff);
assert.equal(juice.objects.size, 10, "damage numbers have a separate cap");
const first = [...juice.objects][0];
tweens.get(first).onComplete();
tweens.delete(first);
juice.number(10, -60, 7, 0xffffff);
assert.equal(juice.objects.size, 10, "expired text returns its slot");
for (let i = 0; i < 30; i++) juice.track(object(), 10, -50, 100, 1);
assert.equal(juice.objects.size, 24, "skills and impacts share one total budget");
juice.project(0, 390, 200, 0.7);
const active = [...juice.objects];
juice.reset();
assert.equal(juice.objects.size, 0);
assert.equal(active.every((entry) => !entry.active), true);
assert.equal(tweens.size, 0, "transition/shutdown kills all feedback tweens");
juice.reducedMotion = true;
juice.beginFrame(500);
juice.hold([sprite], 55); juice.endFrame();
assert.equal(sprite.anims.timeScale, 1.7);
console.log("Hit profiles, boss stability, visual hold expiry/throttle, effect budgets and cleanup passed");
