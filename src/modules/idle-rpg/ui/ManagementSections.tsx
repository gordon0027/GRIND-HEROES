import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { availableGear, equippedIn, gearAllowsHero, type GearItem, type GearSlot } from "../game/equipment";
import type { HeroView, IdleSession } from "../game/session";
import type { SlotIndex } from "../game/stageRun";
import { RECRUITABLE_HERO_IDS } from "../game/progression";
import { heroUi } from "./heroAssets";
import { HERO_LEVEL_CAP, xpToNext } from "../game/heroXP";
import { emptySlotIcon, inventoryHero, rarityColors } from "./inventoryPresentation";
import { gearImage } from "./itemImage";
import { EquipmentArt } from "../../../shared/ui/EquipmentArt";
import { GearStatRows } from "./GearStatRows";
import { PremiumChestPanel } from "./PremiumChestPanel";
import "./management-sections.css";

const slotGroups: [GearSlot[], GearSlot[]] = [["Helmet", "Armor", "Gloves"], ["Weapon", "Offhand", "Boots"]];
function itemImage(item: GearItem | null, slot: GearSlot, heroID: string): string {
  if (item) {
    const resolved = gearImage(item);
    if (resolved) return resolved;
  }
  const icon = emptySlotIcon(slot, heroID);
  return icon.startsWith("function_") ? heroUi.functionIcon(icon) : heroUi.itemIcon(icon);
}

function HeroIcon({ id, small = false }: { id: string; small?: boolean }): ReactNode {
  return <img className={`gh-hero-icon${small ? " gh-hero-icon--small" : ""}`}
    src={heroUi.heroIcon(id)} alt={id} />;
}

function FantasyButton({ children, onClick, disabled = false, primary = false, className = "" }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; className?: string;
}): ReactNode {
  return <button type="button" className={`gh-fantasy-button ${className}`} disabled={disabled} onClick={onClick}
    style={{ borderImageSource: `url("${primary ? heroUi.primary : heroUi.secondary}")` }}>{children}</button>;
}

function ItemSlot({ item, slot, heroID, selected, onClick, label, disabled = false, incompatible = false, levelLocked = false }: {
  item: GearItem | null; slot: GearSlot; heroID: string; selected: boolean;
  onClick: () => void; label: string; disabled?: boolean; incompatible?: boolean; levelLocked?: boolean;
}): ReactNode {
  return <button type="button" className={`gh-item-slot${selected ? " gh-item-slot--selected" : ""}${incompatible ? " gh-item-slot--incompatible" : ""}${levelLocked ? " gh-item-slot--level-locked" : ""}`}
    aria-label={label} aria-pressed={selected} disabled={disabled} title={label} onClick={onClick}
    style={{ backgroundImage: `url("${heroUi.slot}")`, "--gh-rarity": item ? rarityColors[item.rarity] : "transparent" } as CSSProperties}>
    {item ? <EquipmentArt icon={itemImage(item, slot, heroID)} rarity={item.rarity} size="100%" /> :
      <img className="gh-item-slot__icon gh-item-slot__icon--empty"
        src={itemImage(item, slot, heroID)} alt="" />}
    {item?.equippedBy ? <span className="gh-item-slot__equipped">{item.equippedBy.heroID === heroID ? "E" : item.equippedBy.heroID.slice(0, 1)}</span> : null}
    {incompatible || levelLocked ? <span className="gh-item-slot__incompatible" aria-hidden="true">
      {levelLocked ? <img src={heroUi.lock} alt="" /> : "!"}</span> : null}
    {selected ? <img className="gh-item-slot__selection" src={heroUi.selected} alt="" /> : null}
  </button>;
}

function HeroXp({ hero }: { hero: HeroView }): ReactNode {
  const capped = hero.level >= HERO_LEVEL_CAP;
  const needed = capped ? 1 : xpToNext(hero.level);
  return <div className="gh-hero-xp" role="progressbar" aria-label={`${hero.name} XP`}
    aria-valuenow={capped ? 1 : hero.xp} aria-valuemax={needed}>
    <div className="gh-hero-xp__track">
      <div className="gh-hero-xp__fill" style={{ width: `${capped ? 100 : Math.min(100, hero.xp / needed * 100)}%` }} />
      <span className="gh-hero-xp__text">{capped ? "MAX LEVEL" : `${hero.xp} / ${needed} XP`}</span>
    </div>
  </div>;
}

function HeroEquipment({ session, heroID, selectedID, selectItem, showStats }: {
  session: IdleSession; heroID: string; selectedID: string | null; selectItem: (id: string) => void; showStats: () => void;
}): ReactNode {
  const hero = session.roster.find((entry) => entry.id === heroID);
  return <section className="gh-equipment" aria-label="Hero equipment">
    <div className="gh-equipment__side">
      {slotGroups[0].map((slot) => {
        const item = equippedIn(session.gearItems, heroID, slot);
        return <div className="gh-equipment__entry" key={slot}>
          <ItemSlot item={item} slot={slot} heroID={heroID} selected={item?.instanceID === selectedID}
            label={`${slot}: ${item?.name ?? "Empty"}`} onClick={() => item && selectItem(item.instanceID)} disabled={!item} />
          <span>{slot}</span>
        </div>;
      })}
    </div>
    <div className="gh-hero-portrait" style={{ backgroundImage: `url("${heroUi.portrait}")` }}>
      <button type="button" className="gh-hero-portrait__info" aria-label={`Show ${hero?.name ?? heroID} stats`}
        title="Hero stats" onClick={showStats}>i</button>
      {hero ? <HeroIcon id={hero.id} /> : null}
      <div className="gh-hero-portrait__caption">
        <strong>{hero?.name ?? heroID}</strong>
        <span>Lv {hero?.level ?? 1} · Power {session.heroPower(heroID)}</span>
      </div>
      {hero ? <HeroXp hero={hero} /> : null}
    </div>
    <div className="gh-equipment__side">
      {slotGroups[1].map((slot) => {
        const item = equippedIn(session.gearItems, heroID, slot);
        return <div className="gh-equipment__entry" key={slot}>
          <ItemSlot item={item} slot={slot} heroID={heroID} selected={item?.instanceID === selectedID}
            label={`${slot}: ${item?.name ?? "Empty"}`} onClick={() => item && selectItem(item.instanceID)} disabled={!item} />
          <span>{slot}</span>
        </div>;
      })}
    </div>
  </section>;
}

function HeroStatsDialog({ session, heroID, close }: { session: IdleSession; heroID: string; close: () => void }): ReactNode {
  const hero = session.roster.find((entry) => entry.id === heroID);
  const stats = session.heroCombatStats(heroID);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);
  if (!hero || !stats) return null;
  const rows = [
    ["Attack", stats.attack], ["Defence", stats.defence], ["Max HP", stats.maxHp],
    ["Attack Speed", stats.attackSpeed], ["Move Speed", stats.moveSpeed],
    ["Attack Range", stats.attackRange],
  ] as const;
  const number = (value: number) => Number(value.toFixed(2)).toLocaleString("en-US");
  return <div className="gh-hero-stats-overlay" onClick={(event) => {
    if (event.target === event.currentTarget) close();
  }}>
    <section className="gh-hero-stats-dialog" role="dialog" aria-modal="true" aria-label={`${hero.name} stats`}
      style={{ borderImageSource: `url("${heroUi.panel}")` }}>
      <button type="button" className="gh-hero-stats-dialog__close" onClick={close} aria-label="Close hero stats">×</button>
      <div className="gh-hero-stats-dialog__hero">
        <HeroIcon id={hero.id} small />
        <div><span>HERO STATS</span><h3>{hero.name}</h3><p>Lv {hero.level} · Power {session.heroPower(heroID)}</p></div>
      </div>
      <HeroXp hero={hero} />
      <div className="gh-hero-stats-dialog__stats">{rows.map(([label, value]) =>
        <div key={label}><span>{label}</span><strong>{number(value)}</strong></div>)}</div>
    </section>
  </div>;
}

function ItemDetails({ session, heroID, item, close }: {
  session: IdleSession; heroID: string; item: GearItem; close: () => void;
}): ReactNode {
  const current = equippedIn(session.gearItems, heroID, item.slot);
  const problems = session.equipmentProblems(item, heroID);
  const isWornHere = item.equippedBy?.heroID === heroID;
  return <div className="gh-item-detail" role="region" aria-label={`${item.name} details`}>
    <div className="gh-item-detail__header">
      <img src={itemImage(item, item.slot, heroID)} alt="" />
      <div><strong style={{ color: rarityColors[item.rarity] }}>{item.name}</strong>
        <small>{item.rarity} · {item.slot} · Requires Lv {item.requiredLevel}</small></div>
      <button type="button" onClick={close} aria-label="Close item details">×</button>
    </div>
    {current && current.instanceID !== item.instanceID ? <p className="gh-item-detail__compare">Compared with {current.name}</p> : null}
    <GearStatRows item={item} comparedWith={current} />
    {problems.length && !isWornHere ? <div className="gh-item-detail__requirements">{problems.map((problem) =>
      <p key={problem} className="gh-item-detail__problem">{problem}</p>)}</div> : null}
    {isWornHere ? <FantasyButton disabled={session.equipmentBusy}
      onClick={() => void session.unequipGear(heroID, item.slot)}>Unequip</FantasyButton>
      : <FantasyButton primary disabled={problems.length > 0 || session.equipmentBusy}
        onClick={() => void session.equipGear(item.instanceID, heroID)}>Equip</FantasyButton>}
  </div>;
}

function InventoryGrid({ session, heroID, selectedID, selectItem }: {
  session: IdleSession; heroID: string; selectedID: string | null; selectItem: (id: string) => void;
}): ReactNode {
  const available = availableGear(session.gearItems);
  const heroLevel = session.roster.find((entry) => entry.id === heroID)?.level ?? 1;
  return <section className="gh-inventory" aria-label="Equipment inventory">
    <div className="gh-section-title"><strong>Equipment</strong><span>{available.length} items</span>
      <FantasyButton disabled={!session.equipmentReady || session.equipmentBusy}
        onClick={() => void session.equipBestGear(heroID)}>Equip Best</FantasyButton>
    </div>
    {available.length ? <div className="gh-inventory__grid">
      {available.map((item) => {
        const incompatible = !gearAllowsHero(item, heroID);
        const levelLocked = heroLevel < item.requiredLevel;
        return <ItemSlot key={item.instanceID} item={item} slot={item.slot} heroID={heroID}
          selected={selectedID === item.instanceID} incompatible={incompatible} levelLocked={levelLocked}
          label={`${item.name}, ${item.rarity}, ${item.slot}, requires Lv ${item.requiredLevel}${incompatible ? `, requires ${item.allowedHeroes.join(" or ")}` : ""}`}
          onClick={() => selectItem(item.instanceID)} />;
      })}
    </div> : <p className="gh-empty">Your first equipment will appear here after a stage clear.</p>}
  </section>;
}

function FormationPanel({ session, heroID, selectHero }: {
  session: IdleSession; heroID: string; selectHero: (id: string) => void;
}): ReactNode {
  const [target, setTarget] = useState<SlotIndex>(1);
  const [purchaseSlot, setPurchaseSlot] = useState<2 | 3 | null>(null);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const slots = ([1, 2, 3] as const).map((index) => ({
    index, unlocked: index <= session.activeCapacity,
    heroID: session.activeFormation.slots[index - 1],
  }));
  const assigned = (id: string) => slots.find((slot) => slot.heroID === id)?.index;
  const assign = (entry: HeroView) => {
    selectHero(entry.id);
    if (!slots.find((slot) => slot.index === target)?.unlocked || assigned(entry.id)) return;
    void session.assignHero(target, entry.id);
  };
  return <section className="gh-formation" aria-label="Formation">
    <div className="gh-section-title"><strong>Active party</strong><span>{session.activeCapacity} / 3 slots</span></div>
    <div className="gh-formation__slots">{slots.map((slot) => {
      const selected = target === slot.index;
      return <button key={slot.index} type="button" className={`gh-party-slot${selected ? " gh-party-slot--selected" : ""}`}
        onClick={() => slot.unlocked ? setTarget(slot.index) : setPurchaseSlot(slot.index as 2 | 3)} aria-pressed={selected}
        style={{ borderImageSource: `url("${heroUi.panel}")` }}>
        <small>Slot {slot.index}</small>
        {!slot.unlocked ? <><img className="gh-party-slot__lock" src={heroUi.lock} alt="" /><span>+ Unlock</span>
            {session.slotCosts ? <GoldPrice amount={session.slotCosts[slot.index as 2 | 3]} /> : null}</>
          : slot.heroID ? <><HeroIcon id={slot.heroID} small /><strong>{session.roster.find((h) => h.id === slot.heroID)?.name ?? slot.heroID}</strong></>
            : <span>Empty</span>}
      </button>;
    })}</div>
    <div className="gh-section-title"><strong>Heroes</strong><span>Choose a hero for Slot {target}</span></div>
    <div className="gh-formation__roster">{session.roster.filter((hero) => hero.rank > 0).map((hero) => {
      const position = assigned(hero.id);
      return <button type="button" key={hero.id} className={`gh-roster-card${heroID === hero.id ? " gh-roster-card--selected" : ""}`}
        onClick={() => assign(hero)} aria-label={`${hero.name}${position ? `, party slot ${position}` : ""}`}>
        <HeroIcon id={hero.id} small />
        <span><strong>{hero.name}</strong><small>Lv {hero.level}</small></span>
        {position ? <b className="gh-roster-card__position">{position}</b> : null}
      </button>;
    })}{RECRUITABLE_HERO_IDS.some((id) => !session.ownedHeroIDs().has(id)) ?
      <button type="button" className="gh-roster-card gh-roster-card--recruit" onClick={() => setRecruitOpen(true)}>+ Recruit Hero</button> : null}</div>
    {slots.find((slot) => slot.index === target)?.heroID && slots.filter((slot) => slot.heroID).length > 1 ?
      <FantasyButton className="gh-formation__remove" disabled={session.formationBusy}
        onClick={() => void session.assignHero(target, null)}>Remove from Slot {target}</FantasyButton> : null}
    {session.formationError ? <p role="alert" className="gh-item-detail__problem">{session.formationError}</p> : null}
    {recruitOpen ? <RecruitHeroDialog session={session} close={() => setRecruitOpen(false)} /> : null}
    {purchaseSlot ? <PurchaseDialog title={`Unlock Slot ${purchaseSlot}`} close={() => setPurchaseSlot(null)}
      error={session.slotPurchaseError} busy={session.slotPurchaseBusy}
      disabled={purchaseSlot !== session.capacity + 1 || !session.slotCosts}
      detail={purchaseSlot !== session.capacity + 1 ? "Unlock the previous slot first" : "Adds one active party slot. Assign a hero separately."}
      amount={session.slotCosts?.[purchaseSlot] ?? null}
      confirm={async () => { if (await session.unlockPartySlot(purchaseSlot)) { setTarget(purchaseSlot); setPurchaseSlot(null); } }} /> : null}
  </section>;
}

function SectionFrame({ title, kicker, children, className = "" }: {
  title: string; kicker: string; children: ReactNode; className?: string;
}): ReactNode {
  return <section className={`gh-management ${className}`} style={{ borderImageSource: `url("${heroUi.panel}")` }}>
    <header className="gh-management__header"><span>{kicker}</span><h2>{title}</h2></header>
    {children}
  </section>;
}

function HeroSelector({ session, chosenHero, pick }: {
  session: IdleSession; chosenHero: string; pick: (id: string) => void;
}): ReactNode {
  const [recruitOpen, setRecruitOpen] = useState(false);
  const owned = session.roster.filter((hero) => hero.rank > 0);
  const emptyCount = Math.max(0, 3 - owned.length);
  return <><div className="gh-hero-window__selector" aria-label="Select hero">
    {owned.map((hero) => <button key={hero.id} type="button" className={chosenHero === hero.id ? "is-selected" : ""}
      onClick={() => pick(hero.id)} aria-pressed={chosenHero === hero.id} aria-label={hero.name}>
      <HeroIcon id={hero.id} small /><span>{hero.name}</span></button>)}
    {Array.from({ length: emptyCount }, (_, index) => <button key={`empty-${index}`} type="button"
      className="gh-hero-window__add" aria-label="Recruit hero" onClick={() => setRecruitOpen(true)}>+</button>)}
  </div>{recruitOpen ? <RecruitHeroDialog session={session} close={() => setRecruitOpen(false)} /> : null}</>;
}

function GoldPrice({ amount }: { amount: number }): ReactNode {
  return <span className="gh-gold-price"><img src={heroUi.gold} alt="Gold" />{amount.toLocaleString("en-US")}</span>;
}

function PurchaseDialog({ title, detail, amount, busy, disabled, error, confirm, close }: {
  title: string; detail: string; amount: number | null; busy: boolean; disabled: boolean;
  error: string | null; confirm: () => void; close: () => void;
}): ReactNode {
  return <div className="gh-purchase-overlay"><section className="gh-purchase-dialog" role="dialog" aria-modal="true" aria-label={title}
    style={{ borderImageSource: `url("${heroUi.panel}")` }}>
    <button className="gh-purchase-dialog__close" type="button" onClick={close} aria-label="Close purchase">×</button>
    <h3>{title}</h3><p>{detail}</p>
    {amount !== null ? <GoldPrice amount={amount} /> : null}
    {error ? <p role="alert" className="gh-hero-window__error">{error}</p> : null}
    <FantasyButton primary disabled={disabled || busy || amount === null} onClick={confirm}>
      {busy ? "Purchasing…" : "Confirm"}</FantasyButton>
  </section></div>;
}

function RecruitHeroDialog({ session, close }: { session: IdleSession; close: () => void }): ReactNode {
  const [chosen, setChosen] = useState<string | null>(null);
  const available = RECRUITABLE_HERO_IDS.map((id) => session.roster.find((hero) => hero.id === id))
    .filter((hero): hero is HeroView => !!hero && hero.rank <= 0);
  const hero = available.find((entry) => entry.id === chosen);
  if (hero) return <PurchaseDialog title={`Recruit ${hero.name}`} detail="This hero joins your roster. Party slots unlock separately."
    amount={session.recruitCost(hero.id)} busy={session.recruitBusy} error={session.recruitError}
    disabled={false} close={() => setChosen(null)}
    confirm={async () => { if (await session.recruitHero(hero.id)) close(); }} />;
  return <div className="gh-purchase-overlay"><section className="gh-purchase-dialog" role="dialog" aria-modal="true" aria-label="Recruit Hero"
    style={{ borderImageSource: `url("${heroUi.panel}")` }}>
    <button className="gh-purchase-dialog__close" type="button" onClick={close} aria-label="Close recruitment">×</button>
    <h3>Recruit Hero</h3><div className="gh-recruit-options">{available.map((entry) => <button type="button" key={entry.id}
      onClick={() => setChosen(entry.id)} className="gh-recruit-option">
      <HeroIcon id={entry.id} small /><strong>{entry.name}</strong><GoldPrice amount={session.recruitCost(entry.id) ?? 0} />
    </button>)}</div>
  </section></div>;
}

export function InventorySection({ session }: { session: IdleSession }): ReactNode {
  const [preferredHeroID, setPreferredHeroID] = useState<string | null>(null);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const chosenHero = inventoryHero(session.roster, preferredHeroID ?? session.selectedID);
  const selected = session.gearItems.find((item) => item.instanceID === selectedID) ?? null;
  return <SectionFrame title="INVENTORY" kicker="GRIND HEROES / EQUIPMENT" className="gh-management--inventory">
    <PremiumChestPanel session={session} />
    {!chosenHero ? <p className="gh-empty" role="status">Loading inventory…</p> : <>
    <div className="gh-management__inventory-layout">
      <div className="gh-management__hero-column">
        <HeroSelector session={session} chosenHero={chosenHero} pick={setPreferredHeroID} />
        <HeroEquipment session={session} heroID={chosenHero} selectedID={selectedID} selectItem={setSelectedID}
          showStats={() => setStatsOpen(true)} />
      </div>
      <div className="gh-management__items-column">
        <InventoryGrid session={session} heroID={chosenHero} selectedID={selectedID} selectItem={setSelectedID} />
        {selected ? <div style={{ borderImageSource: `url("${heroUi.panel}")` }} className="gh-item-detail-shell">
          <ItemDetails session={session} heroID={chosenHero} item={selected} close={() => setSelectedID(null)} />
        </div> : null}
      </div>
    </div>
    {session.equipmentError ? <p role="alert" className="gh-hero-window__error">{session.equipmentError}</p> : null}
    {statsOpen ? <HeroStatsDialog session={session} heroID={chosenHero} close={() => setStatsOpen(false)} /> : null}
    </>}
  </SectionFrame>;
}

export function TeamSection({ session }: { session: IdleSession }): ReactNode {
  const [heroID, setHeroID] = useState(session.selectedID ?? "Knight");
  return <SectionFrame title="TEAM" kicker="GRIND HEROES / FORMATION" className="gh-management--team">
    <FormationPanel session={session} heroID={heroID} selectHero={setHeroID} />
  </SectionFrame>;
}
