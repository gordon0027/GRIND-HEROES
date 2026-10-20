export const ONBOARDING_KEY = "grind_onboarding_v1";

export type OnboardingStep = "welcome" | "battle" | "victory" | "slot" | "recruit" | "assign" | "complete" | null;

export interface GuideProgress {
  status: "active" | "skipped" | "done";
  welcomed: boolean;
  victorySeen: boolean;
  rewardGold: number | null;
}

/** Keep the original account key and accept saves from the first guide. */
export function restoreGuide(value: string | null | undefined, hasHistory: boolean): GuideProgress {
  const initial: GuideProgress = { status: hasHistory ? "done" : "active", welcomed: false,
    victorySeen: false, rewardGold: null };
  if (value === "active") return { ...initial, status: "active", welcomed: true, victorySeen: hasHistory };
  if (value === "done" || value === "skipped") return { ...initial, status: value };
  try {
    const saved = JSON.parse(value ?? "null");
    if (["active", "skipped", "done"].includes(saved?.status)) return {
      status: saved.status, welcomed: saved.welcomed === true, victorySeen: saved.victorySeen === true,
      rewardGold: Number.isSafeInteger(saved.rewardGold) && saved.rewardGold >= 0 ? saved.rewardGold : null,
    };
  } catch { /* Malformed optional guide data never resets real progress. */ }
  return initial;
}

export function onboardingStep(input: {
  active: boolean;
  welcomed: boolean;
  victorySeen: boolean;
  firstClear: boolean;
  capacity: number;
  archerOwned: boolean;
  archerAssigned: boolean;
}): OnboardingStep {
  if (!input.active) return null;
  if (input.archerAssigned) return "complete";
  if (!input.welcomed && !input.firstClear) return "welcome";
  if (!input.firstClear) return "battle";
  if (!input.victorySeen) return "victory";
  if (input.capacity < 2) return "slot";
  if (!input.archerOwned) return "recruit";
  return "assign";
}
