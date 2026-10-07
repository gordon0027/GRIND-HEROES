import { makeT } from "@idosgames/react/ui";

const EN = {
  title: "Shop",
  free: "Free",
  soldOut: "Sold out",
  refreshesIn: "Refreshes in",
  readyIn: "Ready in",
  confirmTitle: "Confirm purchase",
  confirmBuy: "Buy for",
  confirmFree: "Take for free",
  emptyShop: "The shop is empty. Add offers in LiveOps → Store.",
  left: "left",
  retry: "Retry",
} as const;

export const t = makeT<keyof typeof EN>(EN, {
  title: "Магазин",
  free: "Бесплатно",
  soldOut: "Распродано",
  refreshesIn: "Обновится через",
  readyIn: "Доступно через",
  confirmTitle: "Подтвердите покупку",
  confirmBuy: "Купить за",
  confirmFree: "Забрать бесплатно",
  emptyShop: "В магазине пусто. Добавьте товары в LiveOps → Store.",
  left: "осталось",
  retry: "Повторить",
});
