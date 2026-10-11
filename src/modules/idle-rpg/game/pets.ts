import type { GetStorefrontResponse, IDosGamesClient, StorefrontOfferView } from "@idosgames/core";

export interface PetDefinition {
  id: string;
  name: string;
  itemID: string;
  offerID: string;
  assetKey: string;
  currencyID: "GOLD" | "GEMS" | "Main";
  price: number;
  bonus: { attack: number; maxHp: number };
}

export interface PetState {
  catalog: PetDefinition[];
  ownedPetIds: string[];
  equippedPetId: string | null;
  pendingPetId: string | null;
  hasPendingChange: boolean;
}

export interface PetOffer {
  offer: StorefrontOfferView;
  optionID: string;
  storeID: string;
  sectionID: string;
  slotID: string;
}

const validPet = (pet: PetDefinition): boolean =>
  !!pet && typeof pet.id === "string" && typeof pet.name === "string" &&
  typeof pet.offerID === "string" && typeof pet.assetKey === "string" &&
  ["GOLD", "GEMS", "Main"].includes(pet.currencyID) &&
  Number.isSafeInteger(pet.price) && pet.price > 0 &&
  Number.isFinite(pet.bonus?.attack) && Number.isFinite(pet.bonus?.maxHp);

export function petBonus(state: PetState | null): { attack: number; maxHp: number } {
  const pet = state?.catalog.find((entry) => entry.id === state.equippedPetId);
  return pet && state?.ownedPetIds.includes(pet.id) ? pet.bonus : { attack: 0, maxHp: 0 };
}

export function resolvePetOffer(front: GetStorefrontResponse | null, pet: PetDefinition): PetOffer | null {
  for (const store of front?.Stores ?? [])
    for (const section of store.Sections ?? [])
      for (const slot of section.Slots ?? []) {
        if (slot.Offer?.OfferID !== pet.offerID) continue;
        const option = slot.Offer.PriceOptions?.find((item) =>
          item.Cost?.Standard?.Entries?.length === 1 &&
          item.Cost.Standard.Entries[0]?.Type === (pet.currencyID === "Main" ? "CryptoCurrency" : "VirtualCurrency") &&
          item.Cost.Standard.Entries[0]?.CurrencyID === pet.currencyID &&
          item.Cost.Standard.Entries[0]?.Amount === pet.price);
        const grant = slot.Offer.Rewards?.Standard?.Entries;
        if (!option || grant?.length !== 1 || grant[0]?.Type !== "Item" ||
          grant[0]?.ItemID !== pet.itemID || grant[0]?.Amount !== 1 ||
          slot.Offer.State?.SoldOut) return null;
        return { offer: slot.Offer, optionID: option.OptionID,
          storeID: store.StoreID, sectionID: section.SectionID, slotID: slot.SlotID };
      }
  return null;
}

export class PetService {
  private readonly client: IDosGamesClient;
  constructor(client: IDosGamesClient) { this.client = client; }

  private async call(handler: string, args: { petId?: string | null } = {}): Promise<unknown> {
    const result = await this.client.cloudCode.execute(handler, args);
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    if (result.data.Error) throw new Error(String(result.data.Error.Message ?? result.data.Error.Error));
    return result.data.FunctionResult;
  }

  async load(): Promise<PetState> {
    const value = await this.call("getPetState") as PetState;
    if (!value || !Array.isArray(value.catalog) || value.catalog.length !== 3 ||
        !value.catalog.every(validPet) || !Array.isArray(value.ownedPetIds))
      throw new Error("Pet catalogue unavailable");
    return value;
  }

  async select(petId: string | null): Promise<PetState> {
    const result = await this.call("selectPet", { petId }) as { selected?: boolean; reason?: string };
    if (!result?.selected) throw new Error(result?.reason ?? "Pet selection failed");
    return this.load();
  }

  async storefront(): Promise<GetStorefrontResponse> {
    const result = await this.client.store.getStorefront();
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    return result.data;
  }

  async buy(pet: PetDefinition, offer: PetOffer): Promise<PetState> {
    const result = await this.client.store.purchase(pet.offerID, 1, {
      selectedOptionID: offer.optionID,
      slot: { storeID: offer.storeID, sectionID: offer.sectionID, slotID: offer.slotID },
    });
    if (!result.ok) throw new Error(String(result.error ?? result.reason));
    const inventory = await this.client.user.getUserInventory();
    if (!inventory.ok) throw new Error("Purchase confirmed; inventory refresh failed");
    const state = await this.load();
    if (!state.ownedPetIds.includes(pet.id)) throw new Error("Purchase confirmed; pet ownership is still syncing");
    return state;
  }
}
