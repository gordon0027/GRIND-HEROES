import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  OFFER_NOT_IN_ROTATION,
  type GetStorefrontResponse,
  type StorefrontOfferView,
  type StorefrontSectionView,
  type StorefrontSlotView,
} from "@idosgames/core";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Center,
  EmptyState,
  Icon,
  Popup,
  ResourceList,
  SectionTitle,
  Spinner,
  Tabs,
  Timer,
  canAfford,
  costLines,
  countdown,
  errorText,
  grantLines,
  grantedBy,
  outlined,
  panel,
  useCatalog,
  useCelebrate,
  useGameLayout,
  useNow,
  usePopupClose,
  useSound,
  useStagger,
  useToast,
  useUiKit,
  v,
  type ResourceLine,
  tokenGlyph,
} from "@idosgames/react/ui";
import type { FeatureScreenProps } from "@idosgames/module-sdk";
import {
  earliestRefresh,
  isFree,
  slotsOf,
  sortedSections,
  sortedStores,
} from "./model";
import { t } from "./i18n";
import { TokenShop } from "./TokenShop";
import { tokenStoreOffers } from "./tokenPurchase";

const tokenSectionIDs = new Set<string>(Object.values(tokenStoreOffers).map((offer) => offer.sectionID));

// The shop, drawn from the storefront RESOLVED for this player (client.store.getStorefront — never
// from the raw config): rotation, limits, badges and timers are computed by the server. Layout of the
// Unity shop window (Alikhan/Shop): several stores as tabs, the first section of a store is a
// carousel, the rest are grids; a tap opens the confirmation popup; a purchase shows what was granted
// and the rewards fly to their counters.

interface Picked {
  storeID: string;
  section: StorefrontSectionView;
  slot: StorefrontSlotView;
  offer: StorefrontOfferView;
}

type ShopTab = "gems" | "chests" | "supplies";

export function StoreScreen({ args }: FeatureScreenProps): ReactNode {
  const [tab, setTab] = useState<ShopTab>("gems");
  return <div className="gh-shop-shell">
    <nav className="gh-shop-shell__tabs" aria-label="Shop categories">
      {([ ["gems", "GEMS"], ["chests", "PREMIUM CHESTS"], ["supplies", "SUPPLIES"] ] as const).map(([id, label]) =>
        <button key={id} type="button" aria-current={tab === id ? "page" : undefined}
          className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>)}
    </nav>
    {tab === "supplies" ? <LiveStoreScreen args={args} /> : <TokenShop category={tab} />}
  </div>;
}

function LiveStoreScreen({ args }: Pick<FeatureScreenProps, "args">): ReactNode {
  const client = useIDosGamesClient();
  const [front, setFront] = useState<GetStorefrontResponse | null>(
    client.store.cachedStorefront,
  );
  const [loading, setLoading] = useState(front === null);
  const [failed, setFailed] = useState<string | null>(null);
  const [storeID, setStoreID] = useState<string | null>(
    typeof args?.storeID === "string" ? args.storeID : null,
  );
  const [picked, setPicked] = useState<Picked | null>(null);
  // Server clock offset: timers count from the SERVER time, not the device clock.
  const [skewMs, setSkewMs] = useState(0);
  const now = useNow() + skewMs;

  const load = useCallback(async () => {
    const res = await client.store.getStorefront();
    setLoading(false);
    if (!res.ok) {
      // A title without a Store section answers "not found" — that is an empty shop, not a failure.
      setFailed(
        /not found|not configured/i.test(res.error ?? "")
          ? t("emptyShop")
          : errorText(res.error),
      );
      return;
    }
    setFailed(null);
    setFront(res.data);
    setSkewMs(new Date(res.data.ServerTimeUtc).getTime() - Date.now());
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  // One reload when the nearest card refreshes, instead of polling.
  useEffect(() => {
    const next = client.store.nextRefreshAtUtc();
    if (!next) return;
    const ms = new Date(next).getTime() - (Date.now() + skewMs);
    if (ms <= 0 || ms > 24 * 3600_000) return;
    const id = setTimeout(() => void load(), ms + 500);
    return () => clearTimeout(id);
  }, [front, client, load, skewMs]);

  if (loading)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (failed)
    return (
      <EmptyState
        glyph="shop"
        text={failed}
        action={<Button onClick={() => void load()}>{t("retry")}</Button>}
      />
    );

  const stores = sortedStores(front);
  const store = stores.find((s) => s.StoreID === storeID) ?? stores[0];
  // The GH shelves have their own GEMS / PREMIUM CHESTS views above.
  const sections = sortedSections(store).filter((section) => !tokenSectionIDs.has(section.SectionID));
  if (!store || sections.length === 0)
    return <EmptyState glyph="shop" text={t("emptyShop")} />;
  const [first, ...rest] = sections;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Tabs
        tabs={stores.map((s) => ({
          id: s.StoreID,
          label: s.Identity?.DisplayName ?? s.StoreID,
        }))}
        value={store.StoreID}
        onChange={setStoreID}
      />
      {first ? (
        <div key={`${store.StoreID}:${first.SectionID}`}>
          <SectionTitle
            right={
              <Timer
                at={earliestRefresh(first)}
                now={now}
                label={t("refreshesIn")}
              />
            }
          >
            {first.Identity?.DisplayName ?? first.SectionID}
          </SectionTitle>
          <div
            className="idos-scroll"
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              padding: "4px 4px 12px",
              scrollSnapType: "x mandatory",
            }}
          >
            {slotsOf(first).map((slot, i) => (
              <OfferCard
                key={slot.SlotID}
                slot={slot}
                now={now}
                wide
                index={i}
                onPick={(offer) =>
                  setPicked({
                    storeID: store.StoreID,
                    section: first,
                    slot,
                    offer,
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}
      {rest.map((section) => (
        <div key={`${store.StoreID}:${section.SectionID}`}>
          <SectionTitle
            right={
              <Timer
                at={earliestRefresh(section)}
                now={now}
                label={t("refreshesIn")}
              />
            }
          >
            {section.Identity?.DisplayName ?? section.SectionID}
          </SectionTitle>
          <OfferGrid>
            {slotsOf(section).map((slot, i) => (
              <OfferCard
                key={slot.SlotID}
                slot={slot}
                now={now}
                index={i}
                onPick={(offer) =>
                  setPicked({ storeID: store.StoreID, section, slot, offer })
                }
              />
            ))}
          </OfferGrid>
        </div>
      ))}
      {picked ? (
        <ConfirmPurchase
          picked={picked}
          onReload={load}
          onClose={() => setPicked(null)}
        />
      ) : null}
    </div>
  );
}

function OfferGrid({ children }: { children: ReactNode }): ReactNode {
  const layout = useGameLayout();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${layout === "phone" ? 150 : 180}px, 1fr))`,
        gap: layout === "phone" ? 12 : 16,
      }}
    >
      {children}
    </div>
  );
}

function OfferCard({
  slot,
  now,
  wide = false,
  index,
  onPick,
}: {
  slot: StorefrontSlotView;
  now: number;
  wide?: boolean;
  index: number;
  onPick: (offer: StorefrontOfferView) => void;
}): ReactNode {
  const catalog = useCatalog();
  const layout = useGameLayout();
  const stagger = useStagger();
  const state = useUserState();
  const offer = slot.Offer;
  const width = wide ? (layout === "phone" ? 170 : 200) : undefined;

  // An EMPTY slot is still drawn — the shelf must not jump when a window closes.
  if (!offer)
    return (
      <div
        style={{
          ...panel,
          width,
          minHeight: 200,
          display: "grid",
          placeItems: "center",
          opacity: 0.55,
          scrollSnapAlign: "start",
          flex: "none",
          ...stagger(index),
        }}
      >
        <Icon glyph="lock" size={40} />
      </div>
    );

  const rewards = grantLines(offer.Rewards);
  const main = rewards[0];
  const price = costLines(offer.PriceOptions?.[0]?.Cost);
  const soldOut = offer.State?.SoldOut === true;
  const readyIn = countdown(offer.State?.AvailableAtUtc ?? null, now);
  const free = isFree(offer);
  const disabled = soldOut || readyIn !== null;
  const affordable = canAfford(price, state?.InventoryV2?.VirtualCurrencies);
  const name = catalog.localize(offer.Identity?.DisplayName ?? offer.OfferID);
  const remaining = offer.State?.RemainingToday ?? offer.State?.RemainingTotal;

  return (
    <div
      className={free && !disabled ? "idos-shine" : undefined}
      style={{
        ...panel,
        width,
        flex: wide ? "none" : undefined,
        scrollSnapAlign: "start",
        padding: 12,
        display: "grid",
        gap: 8,
        justifyItems: "center",
        background:
          free && !disabled
            ? `linear-gradient(180deg, color-mix(in srgb, ${v.blue} 45%, ${v.panelDeep}) 0%, ${v.panelDeep} 100%)`
            : panel.background,
        ...stagger(index),
      }}
    >
      <div
        style={{
          ...outlined,
          fontSize: 14,
          textAlign: "center",
          minHeight: 36,
          display: "grid",
          placeItems: "center",
        }}
      >
        {name}
      </div>
      <div
        className={free && !disabled ? "idos-bounce" : undefined}
        style={{
          width: 84,
          height: 84,
          display: "grid",
          placeItems: "center",
          borderRadius: 20,
          background:
            "radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)",
        }}
      >
        <Icon
          glyph={
            main
              ? main.kind === "token"
                ? tokenGlyph(main)
                : catalog.iconOf(main)
              : "gift"
          }
          size={62}
        />
      </div>
      <div style={{ minHeight: 22 }}>
        <ResourceList lines={rewards} />
      </div>
      {remaining != null ? (
        <div
          style={{
            ...outlined,
            fontSize: 11,
            color: v.textDim,
            fontWeight: 700,
          }}
        >
          {t("left")}: {remaining}
        </div>
      ) : null}
      <Button
        tone={free ? "green" : "gold"}
        disabled={disabled}
        attract={free && !disabled}
        onClick={() => onPick(offer)}
        style={{ width: "100%" }}
      >
        {soldOut ? (
          t("soldOut")
        ) : readyIn ? (
          `${t("readyIn")} ${readyIn}`
        ) : free ? (
          t("free")
        ) : (
          <ResourceList lines={price} size={20} dimIf={() => !affordable} />
        )}
      </Button>
    </div>
  );
}

function ConfirmPurchase({
  picked,
  onReload,
  onClose,
}: {
  picked: Picked;
  onReload: () => Promise<void>;
  onClose: () => void;
}): ReactNode {
  const catalog = useCatalog();
  const rewards = grantLines(picked.offer.Rewards);
  const name = catalog.localize(
    picked.offer.Identity?.DisplayName ?? picked.offer.OfferID,
  );
  return (
    <Popup title={t("confirmTitle")} onClose={onClose}>
      <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
        <div style={{ ...outlined, fontSize: 17, textAlign: "center" }}>
          {name}
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {rewards.map((line) => (
            <div
              key={`${line.kind}:${line.id}`}
              style={{ display: "grid", justifyItems: "center", gap: 4 }}
            >
              <Icon
                glyph={
                  line.kind === "token"
                    ? tokenGlyph(line)
                    : catalog.iconOf(line)
                }
                size={54}
              />
              <span style={{ ...outlined, fontSize: 17 }}>×{line.amount}</span>
            </div>
          ))}
        </div>
      </div>
      <BuyButton picked={picked} onReload={onReload} />
    </Popup>
  );
}

function BuyButton({
  picked,
  onReload,
}: {
  picked: Picked;
  onReload: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const close = usePopupClose();
  const celebrate = useCelebrate();
  const toast = useToast();
  const play = useSound();
  const kit = useUiKit();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const option = picked.offer.PriceOptions?.[0];
  const price: ResourceLine[] = costLines(option?.Cost);
  const free = isFree(picked.offer);

  const buy = async () => {
    setBusy(true);
    const res = await client.store.purchase(picked.offer.OfferID, 1, {
      selectedOptionID: option?.OptionID,
      slot: {
        storeID: picked.storeID,
        sectionID: picked.section.SectionID,
        slotID: picked.slot.SlotID,
      },
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error === OFFER_NOT_IN_ROTATION) {
        close();
        await onReload(); // the shelf reshuffled — redraw silently
        return;
      }
      toast(errorText(res.error), "error");
      return;
    }
    play("purchase");
    kit.fx.burst(ref.current);
    close();
    const granted = grantedBy(res.data);
    celebrate(granted.length > 0 ? granted : grantLines(picked.offer.Rewards));
    await onReload();
  };

  return (
    <div ref={ref}>
      <Button
        tone={free ? "green" : "gold"}
        busy={busy}
        attract
        onClick={() => void buy()}
        style={{ width: "100%" }}
        size="lg"
      >
        {free ? (
          t("confirmFree")
        ) : (
          <>
            {t("confirmBuy")} <ResourceList lines={price} size={20} />
          </>
        )}
      </Button>
    </div>
  );
}
