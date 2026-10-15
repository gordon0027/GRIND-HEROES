import type { IDosGamesClient } from "@idosgames/core";
import { heroLevelCost } from "./heroLevel.ts";
import { HERO_SKILLS } from "./progressionSkills.ts";
import type { HeroView } from "./session";

/** One in-flight upgrade per session; an absolute target makes stale retries harmless. */
export class HeroUpgrade {
  busy = false;
  error: string | null = null;
  notice: string | null = null;
  noticeHeroID: string | null = null;
  private client: IDosGamesClient;
  private changed: () => void;
  constructor(client: IDosGamesClient, changed: () => void) { this.client = client; this.changed = changed; }

  async upgrade(hero: HeroView): Promise<void> {
    if (this.busy || heroLevelCost(hero.def, hero.rank) === null) return;
    this.busy = true; this.error = null; this.notice = null; this.noticeHeroID = hero.id; this.changed();
    try {
      const result = await this.client.character.upgradeCharacterLevel(hero.id, { targetLevel: hero.rank + 1 });
      if (!result.ok) throw new Error(String(result.error ?? result.reason));
      const level = result.data.NewLevel;
      this.notice = `${hero.name} reached Level ${level}!${level === HERO_SKILLS.activeLevel ? " Signature skill unlocked." : level === HERO_SKILLS.passiveLevel ? " Passive skill unlocked." : level === HERO_SKILLS.masteryLevel ? " Active skill mastered." : ""}`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      const results = await Promise.allSettled([
        this.client.character.getUserCharacters(), this.client.user.getUserInventory(),
      ]);
      const refreshed = results.every(r => r.status === "fulfilled" && r.value.ok);
      if (!refreshed) this.error = "Could not confirm the latest balance and level. Reload before another upgrade.";
      this.busy = !refreshed;
      this.changed();
    }
  }
}
