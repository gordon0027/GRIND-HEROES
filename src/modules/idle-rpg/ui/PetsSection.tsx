import type { ReactNode } from "react";
import type { IdleSession } from "../game/session";
import type { PetDefinition } from "../game/pets";
import { heroUi } from "./heroAssets";
import "./pets.css";

// Swap these null entries for PNG paths when the final pet art is ready.
const petAssets: Record<string, string | null> = {
  pet_gold_v1: null,
  pet_gems_v1: null,
  pet_gh_v1: null,
};
const currencyIcons: Record<string, string> = {
  GOLD: heroUi.gold,
  GEMS: `${import.meta.env.BASE_URL}assets/ui/source/Component/UI_Etc/status_icon_gem.png`,
  Main: "https://cloud.idosgames.com/drive/img/98JRCAKG/hard-token.png",
};

function balance(session: IdleSession, id: string): number {
  const inventory = session.userInventory();
  const amount = id === "Main" ? inventory?.CryptoCurrencies?.Main?.Amount :
    inventory?.VirtualCurrencies?.[id]?.Amount;
  return Number(amount ?? 0);
}

function PetCard({ session, pet }: { session: IdleSession; pet: PetDefinition }): ReactNode {
  const owned = session.petState?.ownedPetIds.includes(pet.id) ?? false;
  const active = session.petState?.equippedPetId === pet.id;
  const pending = session.petState?.hasPendingChange && session.petState.pendingPetId === pet.id;
  const offer = session.petOffer(pet);
  const currencyReady = session.petCurrencyConfigured(pet.currencyID);
  const canAfford = balance(session, pet.currencyID) >= pet.price;
  const asset = petAssets[pet.assetKey];
  return <article className={`gh-pet-card${active ? " is-equipped" : ""}`}>
    <div className="gh-pet-card__art" aria-label={`${pet.name} placeholder`}>
      {asset ? <img src={asset} alt="" /> : <span aria-hidden="true">?</span>}
    </div>
    <div className="gh-pet-card__body">
      <h3>{pet.name}</h3>
      <p>{pet.bonus.attack > 0 ? `+${pet.bonus.attack} Attack` : null}
        {pet.bonus.attack > 0 && pet.bonus.maxHp > 0 ? " · " : null}
        {pet.bonus.maxHp > 0 ? `+${pet.bonus.maxHp} HP` : null} · all active heroes</p>
      <div className="gh-pet-card__price"><img src={currencyIcons[pet.currencyID]} alt="" />
        <strong>{pet.price.toLocaleString("en-US")} {pet.currencyID === "Main" ? "GH" : pet.currencyID}</strong></div>
    </div>
    <div className="gh-pet-card__action">
      {pending ? <span>QUEUED</span> : active ? <>
        <span>EQUIPPED</span><button type="button" disabled={session.petBusy}
          onClick={() => void session.selectPet(null)}>UNEQUIP</button></> : owned ?
        <button type="button" disabled={session.petBusy} onClick={() => void session.selectPet(pet.id)}>EQUIP</button> :
        <button type="button" disabled={session.petBusy || !offer || !currencyReady || !canAfford}
          onClick={() => void session.buyPet(pet)}>{!offer || !currencyReady ? "UNAVAILABLE" : canAfford ? "BUY" : "INSUFFICIENT"}</button>}
    </div>
  </article>;
}

export function PetsSection({ session }: { session: IdleSession }): ReactNode {
  return <section className="gh-pets" style={{ borderImageSource: `url("${heroUi.panel}")` }}>
    <header><span>GRIND HEROES / COMPANIONS</span><h2>PETS</h2>
      <p>One pet helps your whole active team. Changes during a battle take effect next run.</p></header>
    {session.petError ? <p className="gh-pets__error" role="alert">{session.petError}
      <button type="button" onClick={() => void session.loadPets()}>Retry</button></p> : null}
    {!session.petState ? <p role="status">Loading pets…</p> : <div className="gh-pets__grid">
      {session.petState.catalog.map((pet) => <PetCard key={pet.id} session={session} pet={pet} />)}
    </div>}
    {session.petState?.hasPendingChange ? <p className="gh-pets__queued" role="status">
      Pet change queued for the next run.</p> : null}
  </section>;
}
