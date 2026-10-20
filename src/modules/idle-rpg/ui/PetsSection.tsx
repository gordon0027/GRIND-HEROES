import type { ReactNode } from "react";
import type { IdleSession } from "../game/session";
import type { PetDefinition } from "../game/pets";
import { PET_VISUALS } from "../phaser/petVisuals";
import { heroUi } from "./heroAssets";
import "./pets.css";
import { PhantomPanel } from "./PhantomPanel";

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
  const active = session.visiblePetId === pet.id;
  const bonusActive = session.petState?.equippedPetId === pet.id;
  const pending = session.petState?.hasPendingChange && session.petState.pendingPetId === pet.id;
  const offer = session.petOffer(pet);
  const currencyReady = session.petCurrencyConfigured(pet.currencyID);
  const canAfford = balance(session, pet.currencyID) >= pet.price;
  const asset = PET_VISUALS[pet.id]?.portraitPath;
  return <article className={`gh-pet-card${active ? " is-equipped" : ""}`}>
    <div className="gh-pet-card__art" aria-label={`${pet.name} portrait`}>
      {asset ? <img src={asset} alt="" /> : <span aria-hidden="true">?</span>}
    </div>
    <div className="gh-pet-card__body">
      <h3>{pet.name}</h3>
      <p>{pet.bonus.attack > 0 ? `+${pet.bonus.attack} Attack` : null}
        {pet.bonus.attack > 0 && pet.bonus.maxHp > 0 ? " · " : null}
        {pet.bonus.maxHp > 0 ? `+${pet.bonus.maxHp} HP` : null} · all active heroes</p>
      <div className="gh-pet-card__price"><img src={currencyIcons[pet.currencyID]} alt="" />
        <strong>{pet.price.toLocaleString("en-US")} {pet.currencyID === "Main" ? "GH" : pet.currencyID}</strong></div>
      {pet.currencyID === "Main" ? <p>Uses your in-game GH balance</p> : null}
    </div>
    <div className="gh-pet-card__action">
      {active ? <>
        <span>{pending && !bonusActive ? "IN BATTLE · BONUS NEXT RUN" : "EQUIPPED"}</span><button type="button" disabled={session.petBusy}
          onClick={() => void session.selectPet(null)}>UNEQUIP</button></> : owned ?
        <>{bonusActive && session.petState?.hasPendingChange ? <span>BONUS THIS RUN</span> : null}
          <button type="button" disabled={session.petBusy} onClick={() => void session.selectPet(pet.id)}>EQUIP</button></> :
        <button type="button" disabled={session.petBusy || !offer || !currencyReady || !canAfford}
          onClick={() => void session.buyPet(pet)}>{!offer ? "NO OFFER" : !currencyReady ? "UNAVAILABLE" : canAfford ? "BUY" : "INSUFFICIENT"}</button>}
    </div>
  </article>;
}

export function PetsSection({ session }: { session: IdleSession }): ReactNode {
  return <section className="gh-pets" style={{ borderImageSource: `url("${heroUi.panel}")` }}>
    <header><span>GRIND HEROES / COMPANIONS</span><h2>PETS</h2>
      <p>One pet helps your whole active team. Your chosen pet appears immediately; bonuses change next run.</p></header>
    <PhantomPanel />
    {session.petError ? <p className="gh-pets__error" role="alert">{session.petError}
      <button type="button" onClick={() => void session.loadPets()}>Retry</button></p> : null}
    {!session.petState ? <p role="status">Loading pets…</p> : <div className="gh-pets__grid">
      {session.petState.catalog.map((pet) => <PetCard key={pet.id} session={session} pet={pet} />)}
    </div>}
    {session.petState?.hasPendingChange &&
      session.petState.pendingPetId !== session.petState.equippedPetId ?
      <p className="gh-pets__queued" role="status">
      Pet visual updated now. Passive bonuses change next run.</p> : null}
  </section>;
}
