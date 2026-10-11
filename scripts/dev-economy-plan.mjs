// Explicit ordinary-currency DEV changes. This module performs no network writes.
const copy = value => JSON.parse(JSON.stringify(value));
export const ordinaryPrices = { slot2: 3000, slot3: 12000, Archer: 8000, Mage: 30000,
  gold_bag_small: 40, gold_bag_big: 150, idlePerSecond: 0.4 };

export function ordinaryEconomyPlan({ store, reward, character, cloudCode }) {
  const next = { store: copy(store), reward: copy(reward), character: copy(character), cloudCode };
  for (const id of ["gold_bag_small", "gold_bag_big"]) {
    const entry = next.store.StoreOffers[id].Pricing.Options.default.Cost.Standard.Entries[0];
    if (entry.Type !== "VirtualCurrency" || entry.CurrencyID !== "GEMS") throw new Error(`Unexpected price: ${id}`);
    entry.Amount = ordinaryPrices[id];
  }
  const idle = next.reward.IdleAccruals.idle_gold;
  if (idle.Rewards.Standard.Entries[0].CurrencyID !== "GOLD") throw new Error("Unexpected idle currency");
  idle.Rate.BaseRatePerSecond = ordinaryPrices.idlePerSecond;
  for (const id of ["Archer", "Mage"]) {
    const entry = next.character.Definitions[id].Unlock.PriceOptions.default.Cost.Standard.Entries[0];
    if (entry.CurrencyID !== "GOLD" || entry.Type !== "VirtualCurrency") throw new Error(`Unexpected hero price: ${id}`);
    entry.Amount = ordinaryPrices[id];
  }
  const stageBlock = /gold: 30 \+ ordinal \* 8 \+ \(ordinal >= 20 \? 200 : ordinal >= 10 \? 80 : 0\) \+\s*Math\.floor\(ordinal \/ 10\) \* \(ordinal % 10\) \* 10,\s*heroXP: 25 \+ ordinal \* 5,/;
  const slotBlock = /var GH_PARTY_SLOT_COSTS = \{ 2: \d+, 3: \d+ \};/;
  if (!stageBlock.test(cloudCode) || !slotBlock.test(cloudCode)) throw new Error("Unrecognized CloudCode baseline; inspect before publishing");
  next.cloudCode = cloudCode.replace(stageBlock,
    "gold: [100, 420, 900][chapter - 1] + [25, 40, 60][chapter - 1] * (stageNumber - 1),\n      heroXP: 35 + ordinal * 7,")
    .replace(slotBlock, "var GH_PARTY_SLOT_COSTS = { 2: 3000, 3: 12000 };");
  return next;
}
