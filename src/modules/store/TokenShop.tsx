import { useEffect, useRef, useState, type ReactNode } from "react";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { Popup } from "@idosgames/react/ui";
import { visibleProducts, type ShopCategory, type ShopProduct } from "./shopCatalog";
import { createTokenPurchaseOrder, formatTokenBaseUnits, getTokenShopCatalog,
  type TokenOrder, type TokenQuote } from "./tokenPurchase";
import "./shop.css";

const gemIcon = `${import.meta.env.BASE_URL}assets/ui/source/Component/UI_Etc/status_icon_gem.png`;
const tokenLabel = "Grind Heroes token";

function rewardLabel(terms: TokenQuote): string {
  return terms.rewardType === "GEMS"
    ? `${terms.rewardAmount.toLocaleString()} GEMS`
    : `${terms.rewardAmount} Premium Chest`;
}

function priceLabel(terms: TokenQuote): string {
  return `${formatTokenBaseUnits(terms.tokenAmountBaseUnits, terms.tokenDecimals)} ${tokenLabel}`;
}

export function TokenShop({ category }: { category: ShopCategory }): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const [picked, setPicked] = useState<ShopProduct | null>(null);
  const [artFailed, setArtFailed] = useState<Record<string, boolean>>({});
  const [quotes, setQuotes] = useState<Record<string, TokenQuote> | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const balance = (state?.InventoryV2?.VirtualCurrencies as Record<string, { Amount?: number }> | undefined)?.GEMS?.Amount;

  useEffect(() => {
    void client.cache.ensureState(["InventoryV2"], { maxAgeMs: 60_000 });
    let active = true;
    getTokenShopCatalog(client).then((items) => {
      if (!active) return;
      setQuotes(Object.fromEntries(items.map((item) => [item.productId, item])));
      setCatalogError(null);
    }).catch(() => {
      if (!active) return;
      setQuotes(null);
      setCatalogError("Shop prices are temporarily unavailable.");
    });
    return () => { active = false; };
  }, [client, reload]);

  const products = quotes ? visibleProducts(category).filter((product) => quotes[product.id]) : [];
  return <section className="gh-shop" aria-label={category === "gems" ? "Gem packs" : "Premium chests"}>
    <div className="gh-shop__intro">
      <div>
        <h3>{category === "gems" ? "GEMS" : "PREMIUM CHESTS"}</h3>
        <p>{category === "gems" ? "Stock up for Marketplace equipment." : "One server-rolled equipment reward per chest."}</p>
      </div>
      <div className="gh-shop__balance"><img src={gemIcon} alt="" /> GEMS <strong>{typeof balance === "number" ? balance.toLocaleString() : "—"}</strong></div>
    </div>
    <p className="gh-shop__notice">Prices come from the server. Creating an order does not charge TOKEN or grant a reward.</p>
    {!quotes ? <div className="gh-shop__empty">{catalogError ?? "Loading server prices…"}
      {catalogError ? <button type="button" onClick={() => setReload((value) => value + 1)}>Retry</button> : null}</div> :
      products.length === 0 ? <div className="gh-shop__empty">No products are available in this category.</div> :
        <div className="gh-shop__grid">{products.map((product) => <button key={product.id} type="button"
          className={`gh-shop__card gh-shop__card--${product.rarity?.toLowerCase() ?? (product.category === "chests" ? "premium" : "gems")}`}
          onClick={() => setPicked(product)}>
          {product.badge ? <span className="gh-shop__badge">{product.badge}</span> : null}
          <span className="gh-shop__art">{artFailed[product.id] ? <span aria-hidden="true">{category === "gems" ? "◆" : "✦"}</span> :
            <img src={`${import.meta.env.BASE_URL}${product.art}`} alt="" onError={() => setArtFailed((previous) => ({ ...previous, [product.id]: true }))} />}</span>
          <span className="gh-shop__kind">{product.rarity ?? (product.category === "chests" ? "PREMIUM" : "GEMS")}</span>
          <strong>{rewardLabel(quotes[product.id]!)}</strong>
          <span className="gh-shop__price">{priceLabel(quotes[product.id]!)}</span>
          <span className="gh-shop__card-action">VIEW DETAILS</span>
        </button>)}</div>}
    {picked && quotes?.[picked.id] ? <ProductDetails key={picked.id} product={picked} quote={quotes[picked.id]!}
      artFailed={!!artFailed[picked.id]} onClose={() => setPicked(null)} /> : null}
  </section>;
}

function ProductDetails({ product, quote, artFailed, onClose }: { product: ShopProduct;
  quote: TokenQuote; artFailed: boolean; onClose: () => void }): ReactNode {
  const client = useIDosGamesClient();
  const [phase, setPhase] = useState<"details" | "confirm" | "creating" | "created">("details");
  const [order, setOrder] = useState<TokenOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const pending = useRef(false);

  const create = async () => {
    if (pending.current) return;
    pending.current = true;
    setPhase("creating");
    setError(null);
    key.current ??= crypto.randomUUID();
    try {
      const created = await createTokenPurchaseOrder(client, product.id, key.current);
      setOrder(created);
      setPhase("created");
    } catch {
      setError("The order could not be created. Retry uses the same request ID.");
      setPhase("confirm");
    } finally {
      pending.current = false;
    }
  };

  return <Popup title={product.title} onClose={onClose}>
    <div className="gh-shop__details">
      <div className="gh-shop__detail-art">{artFailed ? <span aria-hidden="true">✦</span> : <img src={`${import.meta.env.BASE_URL}${product.art}`} alt="" />}</div>
      {product.category === "chests" ? <span className="gh-shop__kind gh-shop__kind--premium">Premium</span> : null}
      <p>{product.description}</p>
      {phase === "created" && order ? <>
        <strong role="status">Order created · {order.status}</strong>
        <p>Order ID: <code>{order.orderId}</code></p>
        <p>Reward: {rewardLabel(order)}</p>
        <div className="gh-shop__detail-price">{priceLabel(order)}<small>Exact server order amount · {order.tokenNetwork}</small></div>
        <p>Expires: {new Date(order.expiresAt).toLocaleString()}</p>
        <p>Token payment is not available yet. No payment or reward was processed.</p>
        <button type="button" className="gh-shop__buy" disabled>Pay with TOKEN · coming later</button>
      </> : <>
        <p>Reward: {rewardLabel(quote)}</p>
        <div className="gh-shop__detail-price">{priceLabel(quote)}<small>Current server price</small></div>
        {phase === "details" ? <button type="button" className="gh-shop__buy" onClick={() => setPhase("confirm")}>BUY</button> : <>
          <p>Confirm order creation. No TOKEN will be charged and no reward will be granted.</p>
          <button type="button" className="gh-shop__buy" disabled={phase === "creating"}
            onClick={() => void create()}>{phase === "creating" ? "CREATING ORDER…" : "CONFIRM ORDER"}</button>
        </>}
        {error ? <p role="alert" className="gh-shop__unavailable">{error}</p> : null}
      </>}
    </div>
  </Popup>;
}
