import type { IDosGamesClient } from "@idosgames/core";
import { heroLevelCost } from "./heroLevel.ts";
import { HERO_SKILLS } from "./progressionSkills.ts";
import type { HeroView } from "./session";

/** One in-flight upgrade per session; an absolute target makes stale retries harmless. */
export class HeroUpgrade {
  busy = false;
  reconciling = false;
  needsRefresh = false;
  error: string | null = null;
  notice: string | null = null;
  noticeHeroID: string | null = null;
  private client: IDosGamesClient;
  private changed: () => void;
  private pause: (ms: number) => Promise<void>;
  constructor(client: IDosGamesClient, changed: () => void,
    pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {
    this.client = client; this.changed = changed; this.pause = pause;
  }

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
      await this.reconcile();
    }
  }

  /** Retry only authoritative reads; an uncertain upgrade is never purchased a second time. */
  async refresh(): Promise<void> {
    if (!this.needsRefresh || this.reconciling) return;
    await this.reconcile();
  }

  private async reconcile(): Promise<void> {
    const recovering = this.needsRefresh;
    this.reconciling = true; this.changed();
    let refreshed = false;
    for (const delay of [0, 600, 1800]) {
      if (delay) await this.pause(delay);
      const results = await Promise.allSettled([
        this.client.character.getUserCharacters(), this.client.user.getUserInventory(),
      ]);
      refreshed = results.every(r => r.status === "fulfilled" && r.value.ok);
      if (refreshed) break;
    }
    if (!refreshed) this.error = "Could not refresh your latest balance and level. Refresh Hero before another upgrade.";
    else if (recovering) this.error = null;
    this.needsRefresh = !refreshed; this.busy = !refreshed; this.reconciling = false;
    this.changed();
  }
}
