import { makeT } from "@idosgames/react/ui";

const EN = {
  title: "Quests",
  claim: "Claim",
  claimAll: "Claim all",
  quests: "Quests",
  permanent: "Achievements",
  noQuests: "No quests. Add them in LiveOps → Quests.",
  questsReset: "New quests in",
  objectives: "Goals",
  reward: "Reward",
  points: "Quest points",
  done: "Done",
} as const;

export const t = makeT<keyof typeof EN>(EN, {
  title: "Задания",
  claim: "Забрать",
  claimAll: "Забрать всё",
  quests: "Задания",
  permanent: "Достижения",
  noQuests: "Заданий нет. Добавьте их в LiveOps → Quests.",
  questsReset: "Новые задания через",
  objectives: "Цели",
  reward: "Награда",
  points: "Очки заданий",
  done: "Выполнено",
});
