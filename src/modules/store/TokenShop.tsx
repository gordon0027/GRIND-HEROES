import { useEffect, useState, type ReactNode } from "react";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { Popup, useToast } from "@idosgames/react/ui";
import { SHOP_PAYMENT_CURRENCY, visibleProducts, type ShopCategory, type ShopProduct } from "./shopCatalog";
import { requestTokenPurchase } from "./tokenPurchase";
import "./shop.css";

const gemIcon = `${import.meta.env.BASE_URL}assets/ui/source/Component/UI_Etc/status_icon_gem.png`;

export function TokenShop({ category }: { category: ShopCategory }): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const [picked, setPicked] = useState<ShopProduct | null>(null);
  const [artFailed, setArtFailed] = useState<Record<string, boolean>>({});
  const products = visibleProducts(category);
  const balance = (state?.InventoryV2?.VirtualCurrencies as Record<string, { Amount?: number }> | undefined)?.GEMS?.Amount;

  useEffect(() => {
    void client.cache.ensureState(["InventoryV2"], { maxAgeMs: 60_000 });
  }, [client]);

  return <section className="gh-shop" aria-label={category === "gems" ? "Gem packs" : "Premium chests"}>
    <div className="gh-shop__intro">
      <div>
        <h3>{category === "gems" ? "GEMS" : "PREMIUM CHESTS"}</h3>
        <p>{category === "gems" ? "Stock up for Marketplace equipment." : "One server-rolled equipment reward per chest."}</p>
      </div>
      <div className="gh-shop__balance"><img src={gemIcon} alt="" /> GEMS <strong>{typeof balance === "number" ? balance.toLocaleString() : "—"}</strong></div>
    </div>
    <p className="gh-shop__notice">TOKEN prices are provisional. TOKEN checkout is not connected.</p>
    {products.length === 0 ? <div className="gh-shop__empty">No products are available in this category.</div> :
      <div className="gh-shop__grid">{products.map((product) => <button key={product.id} type="button"
        className={`gh-shop__card gh-shop__card--${product.rarity?.toLowerCase() ?? (product.category === "chests" ? "premium" : "gems")}`}
        onClick={() => setPicked(product)}>
        {product.badge ? <span className="gh-shop__badge">{product.badge}</span> : null}
        <span className="gh-shop__art">{artFailed[product.id] ? <span aria-hidden="true">{category === "gems" ? "◆" : "✦"}</span> :
          <img src={`${import.meta.env.BASE_URL}${product.art}`} alt="" onError={() => setArtFailed((previous) => ({ ...previous, [product.id]: true }))} />}</span>
        <span className="gh-shop__kind">{product.rarity ?? (product.category === "chests" ? "PREMIUM" : "GEMS")}</span>
        <strong>{product.amount ? `${product.amount.toLocaleString()} GEMS` : product.title}</strong>
        <span className="gh-shop__price">≈ {product.provisionalTokenPrice} {SHOP_PAYMENT_CURRENCY}</span>
        <span className="gh-shop__card-action">VIEW DETAILS</span>
      </button>)}</div>}
    {picked ? <ProductDetails product={picked} artFailed={!!artFailed[picked.id]} onClose={() => setPicked(null)} /> : null}
  </section>;
}

function ProductDetails({ product, artFailed, onClose }: { product: ShopProduct; artFailed: boolean; onClose: () => void }): ReactNode {
  const toast = useToast();
  const [purchaseState, setPurchaseState] = useState<"idle" | "unavailable">("idle");
  const buy = () => {
    const result = requestTokenPurchase(product.id);
    setPurchaseState("unavailable");
    toast(result.code === "TOKEN_PROVIDER_NOT_IMPLEMENTED" ? "TOKEN purchases are not available yet." : "This product is currently unavailable.", "error");
  };
  return <Popup title={product.title} onClose={onClose}>
    <div className="gh-shop__details">
      <div className="gh-shop__detail-art">{artFailed ? <span aria-hidden="true">✦</span> : <img src={`${import.meta.env.BASE_URL}${product.art}`} alt="" />}</div>
      {product.category === "chests" ? <span className={`gh-shop__kind gh-shop__kind--${product.rarity?.toLowerCase() ?? "premium"}`}>{product.rarity ? `${product.rarity} · ` : ""}Premium</span> : <strong>{product.amount?.toLocaleString()} GEMS</strong>}
      <p>{product.description}</p>
      <div className="gh-shop__detail-price">≈ {product.provisionalTokenPrice} {SHOP_PAYMENT_CURRENCY} <small>Provisional price</small></div>
      <button type="button" className="gh-shop__buy" onClick={buy}>BUY</button>
      {purchaseState === "unavailable" ? <p role="status" className="gh-shop__unavailable">TOKEN checkout is coming later. No payment or reward was processed.</p> : null}
    </div>
  </Popup>;
}
