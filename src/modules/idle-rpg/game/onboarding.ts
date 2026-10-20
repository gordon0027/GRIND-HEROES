export const ONBOARDING_KEY = "grind_onboarding_v1";

export type OnboardingStep = "battle" | "chest" | "slot" | "recruit" | "assign" | null;

export function onboardingStep(input: {
  active: boolean;
  firstClear: boolean;
  chestCount: number;
  capacity: number;
  archerOwned: boolean;
  archerAssigned: boolean;
}): OnboardingStep {
  if (!input.active || input.archerAssigned) return null;
  if (!input.firstClear) return "battle";
  if (input.chestCount > 0) return "chest";
  if (input.capacity < 2) return "slot";
  if (!input.archerOwned) return "recruit";
  return "assign";
}
