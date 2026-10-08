import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type {
  ItemDefinition,
  MarketplaceDefinitions,
  MarketplaceGroupedOfferView,
  MarketplaceHistoryEntryView,
  MarketplaceMyStateResponse,
  MarketplaceOfferView,
  UserInventoryState,
} from "@idosgames/core";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Card,
  Center,
  EmptyState,
  Icon,
  ItemTile,
  ResourceList,
  Spinner,
  Timer,
  bundleLines,
  canAfford,
  errorText,
  formatAmount,
  grantedBy,
  outlined,
  panel,
  plural,
  useCatalog,
  useCelebrate,
  useNow,
  usePopupClose,
  useSound,
  useStagger,
  useToast,
  v,
  type ItemDefinitionView,
} from "@idosgames/react/ui";
import {
  auctionDurations,
  commissionPercent,
  listingDurations,
  minNextBid,
  offerPrice,
  groupCounts,
  priceBundle,
  sellableItems,
  sortOffers,
  tradableCurrencies,
  type SellableItem,
} from "./model";
import { t } from "./i18n";
import { MarketBrowse } from "./MarketBrowse";
import { itemRarity, itemSlot, itemStatLines, offerLevel, GRIND_REQUIRED_LEVEL } from "./itemPresentation";
import { MarketplaceItemArt } from "./MarketplaceItemArt";
import { MarketPopup } from "./MarketPopup";
import { purchaseListing } from "./purchase";

// The marketplace (Unity Alikhan/Marketplace): a window of tabs — the market by item, my lots, my
// bids, trades, things to claim, history — and everything with detail in popups: an item's lots, one
// lot (buy / bid / take back), and selling (pick an item → listing or auction → price and duration).
// The server holds every escrow and settles every trade.

type Tab = "market" | "mine" | "bids" | "trades" | "claims" | "history";

export function makeMarketplaceScreen(features: FeatureRegistry) {
  return function MarketplaceScreen(_: FeatureScreenProps): ReactNode {
    return <Marketplace features={features} />;
  };
}

function Marketplace({ features }: { features: FeatureRegistry }): ReactNode {
  const client = useIDosGamesClient();
  const [defs, setDefs] = useState<{
    defs: MarketplaceDefinitions | null;
    open: boolean;
  } | null>(null);
  const [mine, setMine] = useState<MarketplaceMyStateResponse | null>(null);
  const [tab, setTab] = useState<Tab>("market");
  const [selling, setSelling] = useState(false);
  const [offer, setOffer] = useState<MarketplaceOfferView | null>(null);
  const [itemID, setItemID] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const loadMine = useCallback(async () => {
    const res = await client.marketplace.getMyState();
    if (res.ok) {
      setMine(res.data);
      features.setBadge(
        "marketplace",
        (res.data.Claimables?.length ?? 0) +
          (res.data.IncomingTrades?.length ?? 0),
      );
    }
  }, [client, features]);

  useEffect(() => {
    void client.marketplace.getDefinitions().then((res) =>
      setDefs(
        res.ok
          ? {
              defs: res.data.Definitions ?? null,
              open:
                res.data.IsOpenNow !== false && res.data.GatePassed !== false,
            }
          : { defs: null, open: false },
      ),
    );
    void client.cache.ensureState(["InventoryV2"], { maxAgeMs: 60_000 });
    void loadMine();
  }, [client, loadMine]);

  const refresh = () => {
    setVersion((n) => n + 1);
    void loadMine();
  };

  if (!defs)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (!defs.defs || defs.defs.Enabled === false)
    return <EmptyState glyph="market" text={t("disabled")} />;

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: "market", label: t("market") },
    { id: "mine", label: t("myLots"), badge: 0 },
    ...(defs.defs.Auctions?.Enabled !== false || (mine?.MyBids?.length ?? 0) > 0
      ? [{ id: "bids" as const, label: t("myBids") }] : []),
    ...((mine?.IncomingTrades?.length ?? 0) +
      (mine?.OutgoingTrades?.length ?? 0) >
    0
      ? [
          {
            id: "trades" as const,
            label: t("trades"),
            badge: mine?.IncomingTrades?.length ?? 0,
          },
        ]
      : []),
    { id: "claims", label: t("claims"), badge: mine?.Claimables?.length ?? 0 },
    { id: "history", label: t("history") },
  ];

  return (
    // minmax(0, 1fr): the tab row scrolls instead of widening the column past the screen.
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 14,
      }}
    >
      {!defs.open ? (
        <div
          style={{
            ...panel,
            padding: 10,
            ...outlined,
            fontSize: 13,
            textAlign: "center",
            color: v.gold,
          }}
        >
          {t("closed")}
        </div>
      ) : null}
      <div className="gh-market__navigation">
        <nav className="gh-market__tabs" aria-label={t("title")}>
          {tabs.map((entry) => <button type="button" key={entry.id}
            className={tab === entry.id ? "is-active" : ""}
            aria-current={tab === entry.id ? "page" : undefined}
            onClick={() => setTab(entry.id)}>
            {entry.label}{entry.badge ? <span className="gh-market__badge">{entry.badge}</span> : null}
          </button>)}
        </nav>
        <button type="button" className="gh-market__button gh-market__button--primary"
          disabled={!defs.open}
          onClick={() => setSelling(true)}
          data-tutorial-anchor="market:sell"
        >
          <Icon glyph="plus" size={16} /> {t("sell")}
        </button>
      </div>
      <div key={`${tab}:${version}`}>
        {tab === "market" ? <MarketBrowse onPick={setItemID} version={version} /> : null}
        {tab === "mine" ? (
          <OfferList
            offers={[...(mine?.MyOffers ?? []), ...(mine?.MyBuyOrders ?? [])]}
            onPick={setOffer}
          />
        ) : null}
        {tab === "bids" ? (
          <OfferList offers={mine?.MyBids ?? []} onPick={setOffer} />
        ) : null}
        {tab === "trades" ? <Trades mine={mine} onDone={refresh} /> : null}
        {tab === "claims" ? (
          <Claims offers={mine?.Claimables ?? []} onDone={refresh} />
        ) : null}
        {tab === "history" ? <History /> : null}
      </div>
      {itemID ? (
        <ItemOffersPopup
          itemID={itemID}
          version={version}
          onPick={(o) => setOffer(o)}
          onClose={() => setItemID(null)}
        />
      ) : null}
      {offer ? (
        <OfferPopup
          offer={offer}
          defs={defs.defs}
          onDone={refresh}
          onClose={() => setOffer(null)}
        />
      ) : null}
      {selling ? (
        <SellPopup
          defs={defs.defs}
          onDone={refresh}
          onClose={() => setSelling(false)}
        />
      ) : null}
    </div>
  );
}

// ── Market ───────────────────────────────────────────────────────────────────────────────────

function OfferRow({
  offer, onPick, index,
}: {
  offer: MarketplaceOfferView;
  onPick: (o: MarketplaceOfferView) => void;
  index: number;
}): ReactNode {
  const catalog = useCatalog();
  const now = useNow();
  const id = offer.GoodsItemID;
  const def = id ? catalog.items.get(id) : null;
  const rarity = itemRarity(def);
  const level = offerLevel(offer);
  const auction = offer.OfferType === "Auction";
  const bid = Number(offer.Auction?.CurrentBid ?? offer.Auction?.StartingBid ?? 0);
  const bidLine = offer.Auction?.BidCurrencyID
    ? [{ kind: "currency" as const, id: offer.Auction.BidCurrencyID, amount: bid }]
    : [];
  return <button type="button" className="gh-market__card" onClick={() => onPick(offer)}
    style={{ "--rarity": catalog.rarityColor(rarity), animationDelay: `${Math.min(index, 8) * 25}ms` } as CSSProperties}
    title={id ? catalog.itemName(id) : offer.GoodsCurrencyID ?? "Offer"}>
    {id ? <MarketplaceItemArt itemID={id} /> : <span className="gh-market__art"><Icon glyph="coin" size={66} /></span>}
    <span className="gh-market__rarity">{rarity}{auction ? " · Auction" : ""}</span>
    <strong>{id ? catalog.itemName(id) : offer.GoodsCurrencyID}</strong>
    <span className="gh-market__meta">{itemSlot(def)} · {t("levelShort")} {level}{Number(offer.GoodsAmount ?? 1) > 1 ? ` · ×${offer.GoodsAmount}` : ""}</span>
    <div className="gh-market__stats">{itemStatLines(def, level).slice(0, 3).map((line) => <span key={line}>{line}</span>)}</div>
    <span className="gh-market__bottom">{auction ? t("currentBid") : t("price")} <ResourceList lines={auction ? bidLine : offerPrice(offer)} size={17} /></span>
    {offer.ExpiresAt ? <Timer at={offer.ExpiresAt} now={now} label={t("endsIn")} /> : null}
  </button>;
}
function OfferList({
  offers,
  onPick,
}: {
  offers: MarketplaceOfferView[];
  onPick: (o: MarketplaceOfferView) => void;
}): ReactNode {
  if (offers.length === 0)
    return <EmptyState glyph="market" text={t("empty")} />;
  return (
    <div className="gh-market__offer-grid">
      {offers.map((o, i) => (
        <OfferRow key={o.OfferID ?? i} offer={o} onPick={onPick} index={i} />
      ))}
    </div>
  );
}

// `version` bumps after any trade on the screen: the list re-reads, so a bought or withdrawn lot leaves it.
function ItemOffersPopup({
  itemID,
  version,
  onPick,
  onClose,
}: {
  itemID: string;
  version: number;
  onPick: (o: MarketplaceOfferView) => void;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const [offers, setOffers] = useState<MarketplaceOfferView[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setOffers(null);
    setFailed(false);
    void client.marketplace
      .getOffersByItem(itemID, undefined, undefined, 24)
      .then((res) => {
        if (!active) return;
        setOffers(res.ok ? sortOffers(res.data.Offers ?? []) : []);
        setNext(res.ok ? (res.data.ContinuationToken ?? null) : null);
        setFailed(!res.ok);
      });
    return () => { active = false; };
  }, [client, itemID, version]);
  const loadMore = async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    const res = await client.marketplace.getOffersByItem(itemID, undefined, next, 24);
    setLoadingMore(false);
    if (!res.ok) { setFailed(true); return; }
    setOffers((current) => sortOffers([...(current ?? []), ...(res.data.Offers ?? [])]));
    setNext(res.data.ContinuationToken ?? null);
  };
  return (
    <MarketPopup title={catalog.itemName(itemID)} onClose={onClose} width={600}>
      {offers === null ? (
        <Center minHeight={120}>
          <Spinner />
        </Center>
      ) : <div style={{ display: "grid", gap: 12 }}>
        {failed ? <p role="alert">{t("loadError")}</p> : null}
        <OfferList offers={offers} onPick={onPick} />
        {next ? <button type="button" className="gh-market__button" disabled={loadingMore}
          onClick={() => void loadMore()}>{loadingMore ? "…" : t("loadMore")}</button> : null}
      </div>}
    </MarketPopup>
  );
}

// ── One lot ──────────────────────────────────────────────────────────────────────────────────

function OfferPopup({
  offer,
  defs,
  onDone,
  onClose,
}: {
  offer: MarketplaceOfferView;
  defs: MarketplaceDefinitions;
  onDone: () => void;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const state = useUserState();
  const toast = useToast();
  const play = useSound();
  const now = useNow();
  const me = client.auth.context?.userID;
  const own = offer.CreatorUserID === me;
  const auction = offer.OfferType === "Auction";
  const ended = offer.ExpiresAt
    ? new Date(offer.ExpiresAt).getTime() <= now
    : false;
  const balances = state?.InventoryV2?.VirtualCurrencies as
    Record<string, { Amount?: number }> | undefined;
  const price = offerPrice(offer);
  const [bid, setBid] = useState(minNextBid(offer, defs));
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [buying, setBuying] = useState(false);
  const buySubmitted = useRef(false);
  const cannotAfford = balances !== undefined && !canAfford(price, balances);
  const itemDef = offer.GoodsItemID ? catalog.items.get(offer.GoodsItemID) as ItemDefinition | undefined : undefined;
  const rarity = itemRarity(itemDef);
  const level = offerLevel(offer);
  const bidLine = offer.Auction?.BidCurrencyID
    ? [
        {
          kind: "currency" as const,
          id: offer.Auction.BidCurrencyID,
          amount: bid,
        },
      ]
    : [];

  const buy = async () => {
    if (buySubmitted.current || !offer.OfferID) return;
    buySubmitted.current = true;
    setBuying(true);
    try {
      const outcome = await purchaseListing(client, offer.OfferID);
      if (outcome.kind === "purchased") {
        play("purchase");
        onDone();
        onClose();
        toast(outcome.inventorySynced ? t("purchased") : t("purchasedRefreshPending"),
          outcome.inventorySynced ? "success" : "error");
      } else if (outcome.kind === "unavailable") {
        onDone();
        onClose();
        toast(t("unavailable"), "error");
      } else if (outcome.kind === "insufficient") {
        toast(t("insufficientGems"), "error");
        void client.user.getUserInventory().catch(() => {});
      } else {
        toast(errorText(outcome.error), "error");
      }
    } catch (error) {
      toast(errorText(String(error)), "error");
    } finally {
      buySubmitted.current = false;
      setBuying(false);
    }
  };

  return (
    <MarketPopup
      title={
        offer.GoodsItemID ? catalog.itemName(offer.GoodsItemID) : t("market")
      }
      onClose={buying ? () => {} : onClose}
    >
      <div className="gh-market__details" style={{ "--rarity": catalog.rarityColor(rarity) } as CSSProperties}>
        {offer.GoodsItemID ? <MarketplaceItemArt itemID={offer.GoodsItemID} size={132} /> : null}
        <span className="gh-market__rarity">{rarity}</span>
        {itemDef ? <ul>
          <li><span>{t("equipmentSlot")}</span><strong>{itemSlot(itemDef) ?? "Item"}</strong></li>
          <li><span>{t("requiredLevel")}</span><strong>{GRIND_REQUIRED_LEVEL[rarity] ?? 1}</strong></li>
          <li><span>{t("upgradeLevel")}</span><strong>{level}</strong></li>
          <li><span>{t("amount")}</span><strong>{Number(offer.GoodsAmount ?? 1)}</strong></li>
          {itemDef.Equipment?.AllowedCharacterIDs?.length ? <li><span>{t("hero")}</span><strong>{itemDef.Equipment.AllowedCharacterIDs.join(" / ")}</strong></li> : null}
          {itemStatLines(itemDef, level).map((line) => <li key={line}><span>{line}</span></li>)}
        </ul> : null}
        <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
          {auction ? t("auction") : t("listing")} ·{" "}
          {own ? t("you") : (offer.CreatorPublicData?.Username ?? t("seller"))}
        </div>
        {offer.ExpiresAt ? (
          <Timer at={offer.ExpiresAt} now={now} label={t("endsIn")} />
        ) : null}
        {auction ? (
          <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
            <span style={{ ...outlined, fontSize: 13, color: v.textDim }}>
              {offer.Auction?.CurrentBidderID
                ? t("currentBid")
                : t("startingBid")}
            </span>
            <ResourceList
              lines={
                offer.Auction?.BidCurrencyID
                  ? [
                      {
                        kind: "currency",
                        id: offer.Auction.BidCurrencyID,
                        amount: Number(
                          offer.Auction.CurrentBid ??
                            offer.Auction.StartingBid ??
                            0,
                        ),
                      },
                    ]
                  : []
              }
              size={24}
            />
            {offer.Auction?.CurrentBidderID === me ? (
              <span style={{ ...outlined, fontSize: 13, color: v.green }}>
                {t("leading")}
              </span>
            ) : null}
          </div>
        ) : (
          <ResourceList lines={price} size={24} />
        )}
      </div>
      {own ? (
        auction ? (
          ended ? (
            <Act
              label={t("claim")}
              tone="gold"
              run={() => client.marketplace.claimAuction(offer.OfferID!)}
              onDone={onDone}
            />
          ) : (
            // An auction runs to its end: bids are escrowed, so the seller cannot pull it.
            <div
              style={{
                ...outlined,
                fontSize: 13,
                color: v.textDim,
                textAlign: "center",
              }}
            >
              {t("auctionRuns")}
            </div>
          )
        ) : (
          <Act
            label={t("cancel")}
            tone="grey"
            run={() => client.marketplace.cancelListing(offer.OfferID!)}
            onDone={onDone}
            refreshInventory
          />
        )
      ) : auction ? (
        ended ? (
          <Act
            label={t("claim")}
            tone="gold"
            run={() => client.marketplace.claimAuction(offer.OfferID!)}
            onDone={onDone}
          />
        ) : (
          <>
            <Stepper
              value={bid}
              min={minNextBid(offer, defs)}
              onChange={setBid}
            />
            <Act
              label={
                <>
                  {t("bid")} <ResourceList lines={bidLine} size={18} />
                </>
              }
              tone="gold"
              disabled={!canAfford(bidLine, balances)}
              run={() => client.marketplace.placeBid(offer.OfferID!, bid)}
              onDone={onDone}
              sound="purchase"
            />
          </>
        )
        ) : (
        confirmBuy ? <div className="gh-market__buy-confirm" aria-busy={buying}>
          <p>{t("buy")} <strong>{offer.GoodsItemID ? catalog.itemName(offer.GoodsItemID) : t("market")}</strong> {t("for")} <ResourceList lines={price} size={18} />?</p>
          {cannotAfford ? <p role="alert">{t("insufficientGems")}</p> : null}
          <Button tone="gold" size="lg" className="gh-market__action gh-market__action--gold"
            disabled={cannotAfford || buying} busy={buying} onClick={() => void buy()}>
            {buying ? t("buying") : t("confirmBuy")}
          </Button>
          <button type="button" className="gh-market__button" disabled={buying}
            onClick={() => setConfirmBuy(false)}>{t("back")}</button>
        </div> : <div className="gh-market__buy-confirm">
          {cannotAfford ? <p role="alert">{t("insufficientGems")}</p> : null}
          <button type="button" className="gh-market__button gh-market__button--primary"
            disabled={cannotAfford} onClick={() => setConfirmBuy(true)}>
            {t("buy")} <ResourceList lines={price} size={18} />
          </button>
        </div>
      )}
    </MarketPopup>
  );
}

type Result =
  { ok: true; data: unknown } | { ok: false; error?: string | null };

/** A button that runs one marketplace call, then closes the popup and celebrates what came in. */
function Act({
  label,
  tone,
  run,
  onDone,
  disabled = false,
  sound = "claim",
  refreshInventory = false,
}: {
  label: ReactNode;
  tone: "gold" | "grey" | "green" | "red";
  run: () => Promise<Result>;
  onDone: () => void;
  disabled?: boolean;
  sound?: "claim" | "purchase";
  refreshInventory?: boolean;
}): ReactNode {
  const client = useIDosGamesClient();
  const close = usePopupClose();
  const celebrate = useCelebrate();
  const toast = useToast();
  const play = useSound();
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);
  return (
    <Button
      tone={tone}
      size="lg"
      className={`gh-market__action gh-market__action--${tone}`}
      disabled={disabled || busy}
      busy={busy}
      onClick={() => {
        if (submitted.current) return;
        submitted.current = true;
        setBusy(true);
        void run().then(async (res) => {
          if (!res.ok) {
            submitted.current = false;
            setBusy(false);
            toast(errorText(res.error), "error");
            return;
          }
          let inventory: { ok: boolean } | null = null;
          if (refreshInventory) {
            try { inventory = await client.user.getUserInventory(); }
            catch { inventory = { ok: false }; }
          }
          submitted.current = false;
          setBusy(false);
          play(sound);
          close();
          onDone();
          if (inventory && !inventory.ok) toast(t("inventoryRefreshPending"), "error");
          const granted = grantedBy(res.data);
          if (granted.length > 0) celebrate(granted);
        }).catch((error) => {
          submitted.current = false;
          setBusy(false);
          toast(errorText(String(error)), "error");
        });
      }}
    >
      {label}
    </Button>
  );
}

function Stepper({
  value,
  min,
  onChange,
  max,
}: {
  value: number;
  min: number;
  onChange: (n: number) => void;
  max?: number;
}): ReactNode {
  const clamp = (n: number) =>
    Math.max(min, max !== undefined ? Math.min(max, n) : n);
  const step = Math.max(1, Math.round(value * 0.1));
  return (
    <div className="gh-market__stepper">
      <button type="button" aria-label="-" onClick={() => onChange(clamp(value - step))}>−</button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) =>
          onChange(clamp(Math.floor(Number(e.target.value) || min)))
        }
      />
      <button type="button" aria-label="+" onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  );
}

function MarketChoices<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}): ReactNode {
  return <div className="gh-market__choices" role="tablist">
    {options.map((option) => <button key={option.id} type="button" role="tab"
      aria-selected={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}
  </div>;
}

// ── Trades, claims, history ──────────────────────────────────────────────────────────────────

function Trades({
  mine,
  onDone,
}: {
  mine: MarketplaceMyStateResponse | null;
  onDone: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const toast = useToast();
  const celebrate = useCelebrate();
  const incoming = mine?.IncomingTrades ?? [];
  const outgoing = mine?.OutgoingTrades ?? [];
  const answer = async (offer: MarketplaceOfferView, accept: boolean) => {
    const res = await client.marketplace.respondDirectTrade(
      offer.OfferID!,
      accept,
    );
    if (!res.ok) return toast(errorText(res.error), "error");
    if (accept && offer.GoodsItemID)
      celebrate([
        {
          kind: "item",
          id: offer.GoodsItemID,
          amount: Number(offer.GoodsAmount ?? 1),
        },
      ]);
    onDone();
  };
  if (incoming.length + outgoing.length === 0)
    return <EmptyState glyph="swords" text={t("empty")} />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {incoming.map((o) => (
        <Card key={o.OfferID!} highlight style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {o.GoodsItemID ? (
              <MarketplaceItemArt itemID={o.GoodsItemID} size={52} />
            ) : null}
            <div style={{ flex: 1 }}>
              <div style={{ ...outlined, fontSize: 14 }}>
                {o.GoodsItemID ? catalog.itemName(o.GoodsItemID) : ""}
              </div>
              <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                {t("from")}{" "}
                {o.CreatorPublicData?.Username ??
                  String(o.CreatorUserID ?? "").slice(-6)}{" "}
                ·{" "}
                {bundleLines(o.Price as never).length ? t("wants") : t("gift")}
              </div>
            </div>
            <ResourceList lines={bundleLines(o.Price as never)} />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Button tone="grey" size="sm" onClick={() => void answer(o, false)}>
              {t("decline")}
            </Button>
            <Button tone="green" size="sm" onClick={() => void answer(o, true)}>
              {t("accept")}
            </Button>
          </div>
        </Card>
      ))}
      {outgoing.map((o, i) => (
        <OfferRow
          key={o.OfferID!}
          offer={o}
          index={i}
          onPick={() =>
            void client.marketplace
              .cancelDirectTrade(o.OfferID!)
              .then(() => onDone())
          }
        />
      ))}
    </div>
  );
}

function Claims({
  offers,
  onDone,
}: {
  offers: MarketplaceOfferView[];
  onDone: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const celebrate = useCelebrate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const claim = async (offer: MarketplaceOfferView | null) => {
    setBusy(offer?.OfferID ?? "all");
    const res = offer
      ? offer.OfferType === "Auction"
        ? await client.marketplace.claimAuction(offer.OfferID!)
        : await client.marketplace.claimBack(offer.OfferID!)
      : await client.marketplace.claimBack();
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    celebrate(grantedBy(res.data));
    onDone();
  };
  if (offers.length === 0) return <EmptyState glyph="gift" text={t("empty")} />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {offers.length > 1 ? (
        <Button
          tone="gold"
          attract
          busy={busy === "all"}
          onClick={() => void claim(null)}
        >
          {t("claimAll")}
        </Button>
      ) : null}
      {offers.map((o, i) => (
        <div
          key={o.OfferID!}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
            alignItems: "center",
          }}
        >
          <OfferRow offer={o} index={i} onPick={() => void claim(o)} />
          <Button
            tone="gold"
            size="sm"
            busy={busy === o.OfferID}
            onClick={() => void claim(o)}
          >
            {t("claim")}
          </Button>
        </div>
      ))}
    </div>
  );
}

function History(): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const stagger = useStagger();
  const me = client.auth.context?.userID;
  const [entries, setEntries] = useState<MarketplaceHistoryEntryView[] | null>(
    null,
  );
  useEffect(() => {
    void client.marketplace
      .getHistory()
      .then((res) => setEntries(res.ok ? (res.data.Entries ?? []) : []));
  }, [client]);
  if (!entries)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (entries.length === 0)
    return <EmptyState glyph="clock" text={t("empty")} />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {entries.map((e, i) => (
        <Card
          key={e.OfferID ?? i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            ...stagger(i),
          }}
        >
          {e.GoodsItemID ? (
            <MarketplaceItemArt itemID={e.GoodsItemID} size={48} />
          ) : null}
          <div style={{ flex: 1 }}>
            <div style={{ ...outlined, fontSize: 14 }}>
              {e.GoodsItemID ? catalog.itemName(e.GoodsItemID) : ""}
            </div>
            <div
              style={{
                ...outlined,
                fontSize: 12,
                color: e.SellerUserID === me ? v.green : v.gold,
              }}
            >
              {e.SellerUserID === me ? t("sold") : t("bought")}
            </div>
          </div>
          <ResourceList lines={bundleLines(e.PricePaid as never)} size={16} />
        </Card>
      ))}
    </div>
  );
}

// ── Selling ──────────────────────────────────────────────────────────────────────────────────

function SellPopup({
  defs,
  onDone,
  onClose,
}: {
  defs: MarketplaceDefinitions;
  onDone: () => void;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const [picked, setPicked] = useState<SellableItem | null>(null);
  const [instanceID, setInstanceID] = useState<string | null>(null);
  const [inventory, setInventory] = useState<UserInventoryState | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  useEffect(() => {
    let active = true;
    void client.user.getUserInventory().then((result) => {
      if (!active) return;
      if (result.ok) setInventory(result.data);
      else setInventoryError(true);
    }).catch(() => { if (active) setInventoryError(true); });
    return () => { active = false; };
  }, [client]);
  const items = catalog.items as Map<
    string,
    ItemDefinitionView & { CatalogID?: string; IsTradable?: boolean | null }
  >;
  const sellable = sellableItems(inventory, items).filter((item) =>
    (items.get(item.itemID) as ItemDefinition | undefined)?.Tags?.includes("grind-gear"));
  const currencies = tradableCurrencies(catalog.currencies as never).filter((id) => id === "GEMS");
  const [kind, setKind] = useState<"listing" | "auction">("listing");
  const [amount, setAmount] = useState(1);
  const [currency, setCurrency] = useState(currencies[0] ?? "CO");
  const [price, setPrice] = useState(100);
  const durations =
    kind === "listing" ? listingDurations(defs) : auctionDurations(defs);
  const [hours, setHours] = useState(durations[0] ?? 24);
  const auctionsOn = defs.Auctions?.Enabled !== false;

  if (!picked)
    return (
      <MarketPopup title={t("pickItem")} onClose={onClose} width={540}>
        {inventoryError ? <EmptyState glyph="market" text={t("loadError")} />
        : inventory === null ? <Center minHeight={120}><Spinner /></Center>
        : currencies.length === 0 ? (
          <EmptyState glyph="market" text={t("noTradableCurrency")} />
        ) : sellable.length === 0 ? (
          <EmptyState glyph="market" text={t("nothingToSell")} />
        ) : (
          <div className="gh-market__sell-grid">
            {sellable.map((s) => <button type="button" className="gh-market__sell-item" key={s.itemID}
              onClick={() => { setPicked(s); setInstanceID(s.instances[0] ?? null); }}>
              <MarketplaceItemArt itemID={s.itemID} size={70} />
              <span>{catalog.itemName(s.itemID)}</span><small>×{s.amount}</small>
            </button>)}
          </div>
        )}
      </MarketPopup>
    );

  const create = async (): Promise<Result> => {
    // The native slot guards Marketplace mutations; this protected check also
    // prevents stale Grind assignments from reaching the listing request.
    if (instanceID) {
      const check = await client.cloudCode.execute("isGrindEquipped", { itemInstanceID: instanceID });
      if (!check.ok) return { ok: false, error: String(check.error ?? check.reason ?? "Equipment check failed") };
      if (check.data.Error) return { ok: false, error: String(check.data.Error.Message ?? check.data.Error.Error) };
      if ((check.data.FunctionResult as { equipped?: boolean } | null)?.equipped)
        return { ok: false, error: "Unequip this item from your Grind Heroes party before listing it." };
    }
    return kind === "listing"
      ? client.marketplace.createListing(
          picked.itemID,
          picked.catalogID,
          picked.instances.length ? 1 : amount,
          priceBundle(currency, price) as never,
          hours,
           instanceID ? [instanceID] : undefined,
        )
      : client.marketplace.createAuction(
          picked.itemID,
          picked.catalogID,
          picked.instances.length ? 1 : amount,
          "VirtualCurrency" as never,
          price,
          hours,
          {
            bidCurrencyID: currency,
             itemInstanceIDs: instanceID ? [instanceID] : undefined,
          },
        );
  };

  return (
    <MarketPopup
      title={catalog.itemName(picked.itemID)}
      onClose={onClose}
      width={440}
    >
      <div className="gh-market__sell-preview">
        <MarketplaceItemArt itemID={picked.itemID} size={114} />
        <span className="gh-market__rarity">{itemRarity(catalog.items.get(picked.itemID))}</span>
        <div className="gh-market__stats">
          {itemStatLines(catalog.items.get(picked.itemID), picked.instances.length
            ? Number(inventory?.UnstackableItems?.[instanceID ?? ""]?.Level ?? 1)
            : 1).map((line) => <span key={line}>{line}</span>)}
        </div>
      </div>
      {picked.instances.length > 1 ? <Field label={t("itemCopy")}>
        <select value={instanceID ?? ""} onChange={(event) => setInstanceID(event.target.value)}
          style={{ padding: 10, background: v.wellSoft, color: v.text, borderColor: v.panelEdge }}>
          {picked.instances.map((id, index) => <option key={id} value={id}>{t("copy")} {index + 1}</option>)}
        </select>
      </Field> : null}
      {auctionsOn ? (
        <MarketChoices
          options={[
            { id: "listing", label: t("listing") },
            { id: "auction", label: t("auction") },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setHours(
              (k === "listing"
                ? listingDurations(defs)
                : auctionDurations(defs))[0] ?? 24,
            );
          }}
        />
      ) : null}
      {picked.instances.length === 0 && picked.amount > 1 ? (
        <Field label={t("amount")}>
          <Stepper
            value={amount}
            min={1}
            max={picked.amount}
            onChange={setAmount}
          />
        </Field>
      ) : null}
      <Field label={kind === "listing" ? t("price") : t("startingBid")}>
        {currencies.length > 1 ? (
          <MarketChoices
            options={currencies.map((c) => ({
              id: c,
              label: catalog.currencyName(c),
            }))}
            value={currency}
            onChange={setCurrency}
          />
        ) : null}
        <Stepper value={price} min={1} onChange={setPrice} />
        <ResourceList lines={[{ kind: "currency", id: currency, amount: price }]} size={18} />
      </Field>
      <Field label={t("duration")}>
        <MarketChoices
          options={durations.map((h) => ({
            id: String(h),
            label: `${h} ${t("hours")}`,
          }))}
          value={String(hours)}
          onChange={(h) => setHours(Number(h))}
        />
      </Field>
      {commissionPercent(defs) > 0 ? (
        <div
          style={{
            ...outlined,
            fontSize: 12,
            color: v.textDim,
            textAlign: "center",
          }}
        >
          {t("commission")}: {commissionPercent(defs)}%
        </div>
      ) : null}
      <Act label={t("create")} tone="gold" run={create} onDone={onDone} refreshInventory />
    </MarketPopup>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>{label}</div>
      {children}
    </div>
  );
}
