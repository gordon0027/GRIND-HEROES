import { makeT } from "@idosgames/react/ui";

const EN = {
  title: "Chests",
  open: "Open",
  openTimes: "Open",
  opening: "Opening…",
  noChests: "No chests in this game yet. Add them in LiveOps → Lootboxes.",
} as const;

export const t = makeT<keyof typeof EN>(EN, {
  title: "Сундуки",
  open: "Открыть",
  openTimes: "Открыть",
  opening: "Открываем…",
  noChests: "Сундуков пока нет. Добавьте их в LiveOps → Lootboxes.",
});
