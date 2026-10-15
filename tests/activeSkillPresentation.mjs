import assert from "node:assert/strict";
import { COMBAT_SKILLS } from "../src/modules/idle-rpg/game/combatSkills.ts";
import { activeSkillPresentation } from "../src/modules/idle-rpg/ui/activeSkillPresentation.ts";

assert.deepEqual(Object.keys(COMBAT_SKILLS).sort(), ["Archer", "Knight", "Mage"]);
for (const [heroID, config] of Object.entries(COMBAT_SKILLS)) {
  const skill = activeSkillPresentation(heroID);
  assert.ok(skill, `${heroID} must have a visible skill`);
  assert.equal(skill.id, config.id);
  assert.equal(skill.cooldown, `${config.cooldown} seconds`);
  assert.ok(skill.description.length > 20);
}

const knight = activeSkillPresentation("Knight");
assert.equal(knight.name, "Crushing Blow");
assert.match(knight.description, new RegExp(`${COMBAT_SKILLS.Knight.damageMultiplier * 100}%`));
assert.deepEqual(knight.details.map(({ label }) => label), ["DAMAGE"]);

const archer = activeSkillPresentation("Archer");
assert.equal(archer.name, "Rapid Fire");
assert.match(archer.description, new RegExp(`${(COMBAT_SKILLS.Archer.attackSpeedMultiplier - 1) * 100}%`));
assert.match(archer.description, new RegExp(`${COMBAT_SKILLS.Archer.buffDuration} seconds`));
assert.deepEqual(archer.details.map(({ label }) => label), ["ATTACK SPEED", "DURATION"]);

const mage = activeSkillPresentation("Mage");
assert.equal(mage.name, "Meteor");
assert.match(mage.description, new RegExp(`${COMBAT_SKILLS.Mage.damageMultiplier * 100}%`));
assert.equal(mage.details.find(({ label }) => label === "TARGET")?.value, "Area of Effect");
assert.equal(activeSkillPresentation("Unknown"), null);

console.log("Active skill UI mapping matches all three combat configs");
