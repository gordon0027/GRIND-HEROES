import type { IDosGamesClient } from "@idosgames/core";

export interface TeamPowerRow {
  rank: number;
  displayName: string;
  avatar: string | null;
  power: number;
  isYou: boolean;
}

export interface TeamPowerLeaderboard {
  power: number;
  heroes: Array<{ heroID: string; power: number }>;
  rank: number | null;
  entries: TeamPowerRow[];
  topLimit: number;
}

export class TeamPowerService {
  constructor(private readonly client: IDosGamesClient) {}

  private async execute(handler: string): Promise<unknown> {
    // Deliberately no score, hero stats, or formation argument. CloudCode reads
    // all inputs from the authenticated player's authoritative state.
    const result = await this.client.cloudCode.execute(handler, {});
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    if (result.data.Error) throw new Error(String(result.data.Error.Message ?? result.data.Error.Error));
    return result.data.FunctionResult;
  }

  async refresh(): Promise<{ power: number }> {
    const value = await this.execute("recalculateTeamPower") as { power?: unknown } | null;
    if (!Number.isSafeInteger(value?.power) || Number(value?.power) < 0)
      throw new Error("Invalid Team Power response");
    return { power: Number(value!.power) };
  }

  async leaderboard(): Promise<TeamPowerLeaderboard> {
    const value = await this.execute("getTeamPowerLeaderboard") as TeamPowerLeaderboard | null;
    if (!value || !Number.isSafeInteger(value.power) || !Array.isArray(value.entries))
      throw new Error("Invalid Power leaderboard response");
    return value;
  }
}
