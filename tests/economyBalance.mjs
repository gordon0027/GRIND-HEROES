import assert from "node:assert/strict";
import { ordinaryEconomyPlan, ordinaryPrices } from "../scripts/dev-economy-plan.mjs";
const price=(currency,amount,type="VirtualCurrency")=>({Type:type,CurrencyID:currency,Amount:amount});
const offer=entry=>({Pricing:{Options:{default:{Cost:{Standard:{Entries:[entry]}}}}}});
const before={store:{StoreOffers:{gold_bag_small:offer(price("GEMS",50)),gold_bag_big:offer(price("GEMS",200)),
  pet_gh_v1:offer(price("Main",1,"CryptoCurrency")),gh_gems_small:offer(price("Main",1,"CryptoCurrency")),
  pet_gold_v1:offer(price("GOLD",100)),pet_gems_v1:offer(price("GEMS",20))},Stores:{shop:{keep:true}}},
  reward:{Claims:{keep:true},IdleAccruals:{idle_gold:{Rate:{BaseRatePerSecond:0.3,PowerCoefficient:0},
    Rewards:{Standard:{Entries:[price("GOLD",1)]}},MaxAccumulationSeconds:28800},other:{keep:true}}},
  character:{Definitions:Object.fromEntries(["Archer","Mage"].map(id=>[id,{Stats:{keep:true},
    Unlock:{PriceOptions:{default:{Cost:{Standard:{Entries:[price("GOLD",id==="Archer"?25000:100000)]}}}}}}]))},
  cloudCode:`gold: 30 + ordinal * 8 + (ordinal >= 20 ? 200 : ordinal >= 10 ? 80 : 0) +
        Math.floor(ordinal / 10) * (ordinal % 10) * 10,
      heroXP: 25 + ordinal * 5,
var GH_PARTY_SLOT_COSTS = { 2: 5000, 3: 25000 };
function protectedTokenLogic() { return "unchanged"; }`};
const original=structuredClone(before);
const after=ordinaryEconomyPlan(before);
assert.deepEqual(before,original,"plan never mutates its input");
for(const id of ["pet_gh_v1","gh_gems_small","pet_gold_v1","pet_gems_v1"])
  assert.deepEqual(after.store.StoreOffers[id],before.store.StoreOffers[id],id);
assert.deepEqual(after.store.Stores,before.store.Stores);
assert.deepEqual(after.reward.Claims,before.reward.Claims);
assert.deepEqual(after.reward.IdleAccruals.other,before.reward.IdleAccruals.other);
assert.equal(after.reward.IdleAccruals.idle_gold.MaxAccumulationSeconds,28800);
assert.ok(after.cloudCode.endsWith('function protectedTokenLogic() { return "unchanged"; }'));
assert.throws(()=>ordinaryEconomyPlan({...before,cloudCode:"unknown revision"}),/baseline/);
assert.equal(after.character.Definitions.Archer.Unlock.PriceOptions.default.Cost.Standard.Entries[0].Amount,ordinaryPrices.Archer);
assert.deepEqual(after.character.Definitions.Mage.Stats,before.character.Definitions.Mage.Stats);
console.log("Ordinary DEV price plan preserves token offers, pet ownership/bonuses, unrelated rewards and hero stats");
