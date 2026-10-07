import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { ItemDefinition, MarketplaceGroupedOfferView } from "@idosgames/core";
import { useIDosGamesClient } from "@idosgames/react";
import { plural, useCatalog } from "@idosgames/react/ui";
import { groupCounts } from "./model";
import { t } from "./i18n";
import { GRIND_RARITIES, GRIND_REQUIRED_LEVEL, GRIND_SLOTS, itemRarity, itemSlot, itemStatLines } from "./itemPresentation";
import { MarketplaceItemArt } from "./MarketplaceItemArt";
import "./marketplace.css";

type Sort = "name" | "rarity" | "count";

export function MarketBrowse({ onPick, version }: { onPick: (itemID: string) => void; version: number }): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const [groups, setGroups] = useState<MarketplaceGroupedOfferView[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState("");
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setGroups(null);
    void client.marketplace.getGroupedOffers().then((res) => {
      if (!active) return;
      setGroups(res.ok ? (res.data.Groups ?? []) : []);
      setError(!res.ok);
    });
    return () => { active = false; };
  }, [client, version]);

  const definitions = catalog.items as Map<string, ItemDefinition>;
  const all = useMemo(() => (groups ?? []).filter((g) => !!g.GoodsItemID
    && definitions.get(g.GoodsItemID)?.Tags?.includes("grind-gear")
    && (groupCounts(g).listings + groupCounts(g).auctions) > 0), [groups, definitions]);
  const equipment = [...definitions.values()].filter((def) => def.Tags?.includes("grind-gear"));
  const availableSlots = GRIND_SLOTS.filter((id) => equipment.some((def) => itemSlot(def) === id));
  const availableRarities = GRIND_RARITIES.filter((id) => equipment.some((def) => itemRarity(def) === id));
  const shown = all.filter((g) => {
    const def = definitions.get(g.GoodsItemID!);
    return (!search || catalog.itemName(g.GoodsItemID!).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
      && (!slot || itemSlot(def) === slot)
      && (!rarity || itemRarity(def) === rarity);
  }).sort((a, b) => {
    if (sort === "count") return (groupCounts(b).listings + groupCounts(b).auctions) - (groupCounts(a).listings + groupCounts(a).auctions);
    if (sort === "rarity") return GRIND_RARITIES.indexOf(itemRarity(definitions.get(b.GoodsItemID!)) as typeof GRIND_RARITIES[number])
      - GRIND_RARITIES.indexOf(itemRarity(definitions.get(a.GoodsItemID!)) as typeof GRIND_RARITIES[number]);
    return catalog.itemName(a.GoodsItemID!).localeCompare(catalog.itemName(b.GoodsItemID!));
  });
  const clear = () => { setSearch(""); setSlot(""); setRarity(""); };
  const active = !!(search || slot || rarity);

  return <section className="gh-market" aria-label="Marketplace browse">
    <div className="gh-market__heading"><div><h2>{t("browseTitle")}</h2><p>{t("browseSubtitle")}</p></div></div>
    <div className="gh-market__layout">
      <button className="gh-market__filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>{t("filters")} {active ? "•" : ""}</button>
      <aside className={`gh-market__filters${filtersOpen ? " is-open" : ""}`} aria-label={t("filters")}>
        <h3>{t("filters")}</h3>
        <label className="gh-market__field">{t("search")}<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("itemName")} /></label>
        <div className="gh-market__field"><span>{t("equipmentSlot")}</span><div className="gh-market__options">
          <button type="button" aria-pressed={!slot} onClick={() => setSlot("")}>{t("all")}</button>
          {availableSlots.map((id) => <button key={id} type="button" aria-pressed={slot === id} onClick={() => setSlot(slot === id ? "" : id)}>{id}</button>)}
        </div></div>
        <div className="gh-market__field"><span>{t("rarity")}</span><div className="gh-market__options">
          <button type="button" aria-pressed={!rarity} onClick={() => setRarity("")}>{t("all")}</button>
          {availableRarities.map((id) => <button key={id} type="button" aria-pressed={rarity === id} onClick={() => setRarity(rarity === id ? "" : id)} style={{ color: catalog.rarityColor(id) }}>{id}</button>)}
        </div></div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="gh-market__toolbar"><span>{groups === null ? "…" : `${shown.length} ${plural(shown.length, t("itemTypes"))} · ${shown.reduce((sum, g) => sum + groupCounts(g).listings + groupCounts(g).auctions, 0)} ${plural(shown.reduce((sum, g) => sum + groupCounts(g).listings + groupCounts(g).auctions, 0), t("offers"))}`}</span>
          <label>{t("sort")} <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">{t("sortName")}</option><option value="rarity">{t("sortRarity")}</option><option value="count">{t("sortCount")}</option>
          </select></label></div>
        {active ? <div className="gh-market__chips">
          {search ? <button className="gh-market__chip" onClick={() => setSearch("")}>“{search}” ×</button> : null}
          {slot ? <button className="gh-market__chip" onClick={() => setSlot("")}>{slot} ×</button> : null}
          {rarity ? <button className="gh-market__chip" onClick={() => setRarity("")}>{rarity} ×</button> : null}
          <button className="gh-market__chip" onClick={clear}>{t("clearAll")}</button>
        </div> : null}
        {groups === null ? <div className="gh-market__grid" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div className="gh-market__card" key={i} style={{ opacity: .4 }} />)}</div>
          : error ? <div className="gh-market__empty" role="alert">{t("loadError")}</div>
          : shown.length === 0 ? <div className="gh-market__empty">{active ? t("noMatches") : t("noListings")}{active ? <p><button className="gh-market__chip" onClick={clear}>{t("clearFilters")}</button></p> : null}</div>
          : <div className="gh-market__grid">{shown.map((g) => {
            const id = g.GoodsItemID!;
            const def = definitions.get(id);
            const rar = itemRarity(def);
            const counts = groupCounts(g);
            return <button type="button" className="gh-market__card" key={id} onClick={() => onPick(id)}
              style={{ "--rarity": catalog.rarityColor(rar) } as CSSProperties} title={catalog.itemName(id)}>
              <MarketplaceItemArt itemID={id} />
              <span className="gh-market__rarity">{rar}</span>
              <strong>{catalog.itemName(id)}</strong>
              <span className="gh-market__meta">{itemSlot(def) ?? def?.ItemClass ?? "Item"} · {t("requiredLevel")} {GRIND_REQUIRED_LEVEL[rar] ?? 1}</span>
              <div className="gh-market__stats">{itemStatLines(def).slice(0, 3).map((line) => <span key={line}>{line}</span>)}</div>
              <span className="gh-market__bottom">{counts.listings} {plural(counts.listings, t("lots"))}{counts.auctions ? ` · ${counts.auctions} ${plural(counts.auctions, t("auctions"))}` : ""} →</span>
            </button>;
          })}</div>}
      </div>
    </div>
  </section>;
}
