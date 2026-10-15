import { COMBAT_SKILLS } from "../game/combatSkills.ts";
import { HERO_SKILLS } from "../game/progressionSkills.ts";

export type ActiveSkillPresentation = {
  id: string;
  classId: "Knight" | "Archer" | "Mage";
  name: string;
  description: string;
  cooldown: string;
  details: readonly { label: string; value: string }[];
};

const percent = (multiplier: number) => `${Math.round(multiplier * 100)}%`;
const seconds = (duration: number) => `${duration} seconds`;

// The roster's ClassID is Warrior/Ranger/Mage; combat skills use the playable hero IDs.
export function activeSkillPresentation(heroID: string, level = 1, progression = false): ActiveSkillPresentation | null {
  const mastered = progression && level >= HERO_SKILLS.masteryLevel;
  switch (heroID) {
    case "Knight": {
      const skill = COMBAT_SKILLS.Knight;
      const damage = percent(mastered ? HERO_SKILLS.mastery.Knight : skill.damageMultiplier);
      return {
        id: skill.id, classId: skill.classId, name: "Crushing Blow",
        description: `Delivers a devastating sword strike dealing ${damage} damage to a single enemy.`,
        cooldown: seconds(skill.cooldown),
        details: [{ label: "DAMAGE", value: `${damage} of normal attack damage` }],
      };
    }
    case "Archer": {
      const skill = COMBAT_SKILLS.Archer;
      const speed = percent(skill.attackSpeedMultiplier - 1);
      const duration = seconds(mastered ? HERO_SKILLS.mastery.Archer : skill.buffDuration);
      return {
        id: skill.id, classId: skill.classId, name: "Rapid Fire",
        description: `Increases attack speed by ${speed} for ${duration}.`,
        cooldown: seconds(skill.cooldown),
        details: [
          { label: "ATTACK SPEED", value: `+${speed}` },
          { label: "DURATION", value: duration },
        ],
      };
    }
    case "Mage": {
      const skill = COMBAT_SKILLS.Mage;
      const damage = percent(mastered ? HERO_SKILLS.mastery.Mage : skill.damageMultiplier);
      return {
        id: skill.id, classId: skill.classId, name: "Meteor",
        description: `Launches a massive fireball that explodes, dealing ${damage} damage to nearby enemies.`,
        cooldown: seconds(skill.cooldown),
        details: [
          { label: "DAMAGE", value: `${damage} of normal attack damage` },
          { label: "TARGET", value: "Area of Effect" },
        ],
      };
    }
    default: return null;
  }
}
