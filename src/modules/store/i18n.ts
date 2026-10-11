import { makeT } from "@idosgames/react/ui";

const EN = {
  title: "Shop",
  free: "Free",
  soldOut: "Sold out",
  refreshesIn: "Refreshes in",
  readyIn: "Ready in",
  confirmTitle: "Confirm purchase",
  close: "Close purchase",
  confirmBuy: "Buy for",
  confirmFree: "Take for free",
  emptyShop: "The shop is empty. Add offers in LiveOps → Store.",
  left: "left",
  retry: "Retry",
  purchased: "Purchase confirmed. Balances updated.",
  purchasedRefreshPending: "Purchase confirmed. Refresh balances to see the latest amounts.",
  insufficient: "Not enough GEMS for this purchase.",
} as const;

export const t = makeT<keyof typeof EN>(EN, {
  title: "Магазин",
  free: "Бесплатно",
  soldOut: "Распродано",
  refreshesIn: "Обновится через",
  readyIn: "Доступно через",
  confirmTitle: "Подтвердите покупку",
  close: "Закрыть покупку",
  confirmBuy: "Купить за",
  confirmFree: "Забрать бесплатно",
  emptyShop: "В магазине пусто. Добавьте товары в LiveOps → Store.",
  left: "осталось",
  retry: "Повторить",
  purchased: "Покупка подтверждена. Балансы обновлены.",
  purchasedRefreshPending: "Покупка подтверждена. Обновите балансы, чтобы увидеть новые суммы.",
  insufficient: "Недостаточно GEMS для покупки.",
});
