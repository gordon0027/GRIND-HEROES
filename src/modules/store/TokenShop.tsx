import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { Popup, useToast } from "@idosgames/react/ui";
import { visibleProducts, type ShopCategory, type ShopProduct } from "./shopCatalog";
import {
  createTokenPurchaseGate, formatWholeGh, purchaseTokenShopProduct, resolveTokenShopOffer,
  showDepositOnPurchaseError, tokenPurchaseMessage,
  type ResolvedTokenOffer, type TokenPurchaseError,
} from "./tokenPurchase";
import { AuthType, type GetStorefrontResponse } from "@idosgames/core";
import "./shop.css";

const gemIcon = `${import.meta.env.BASE_URL}assets/ui/source/Component/UI_Etc/status_icon_gem.png`;
const ghIcon = "https://cloud.idosgames.com/drive/img/98JRCAKG/hard-token.png";

function rewardLabel(offer: ResolvedTokenOffer): string {
  return offer.productID === "premium_chest_v1"
    ? `${offer.rewardAmount} Premium Chest`
    : `${offer.rewardAmount.toLocaleString()} GEMS`;
}

function depositGh(titleID: string): void {
  // The canonical iDos page owns the deposit card, whether the game was opened there or directly.
  window.open(`https://idosgames.com/app/${titleID.replace(/-DEV$/, "")}/`, "_blank", "noopener,noreferrer");
}

export function TokenShop({ category }: { category: ShopCategory }): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const [picked, setPicked] = useState<ShopProduct | null>(null);
  const [artFailed, setArtFailed] = useState<Record<string, boolean>>({});
  const [front, setFront] = useState<GetStorefrontResponse | null>(client.store.cachedStorefront);
  const [loading, setLoading] = useState(front === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const balanceRequest = useRef(false);
  const gems = state?.InventoryV2?.VirtualCurrencies?.GEMS?.Amount;
  const gh = state?.InventoryV2?.CryptoCurrencies?.Main?.Amount ?? "0";
  const iou = state?.InventoryV2?.VirtualCurrencies?.Main_IOU?.Amount ?? 0;
  const signedInWithIdos = client.auth.lastAuthType === AuthType.iDosGames;

  const refreshBalance = useCallback(async () => {
    if (balanceRequest.current) return;
    balanceRequest.current = true;
    setBalanceRefreshing(true);
    try {
      const result = await client.user.getUserInventory();
      setBalanceError(!result.ok);
    } catch {
      setBalanceError(true);
    } finally {
      balanceRequest.current = false;
      setBalanceRefreshing(false);
    }
  }, [client]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await client.store.getStorefront();
    if (result.ok) {
      setFront(result.data);
      setLoadError(null);
    } else {
      setLoadError("Shop offers are temporarily unavailable.");
    }
    setLoading(false);
  }, [client]);

  useEffect(() => {
    void refreshBalance();
    void load();
    const refreshAfterDeposit = () => { void refreshBalance(); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshBalance();
    };
    window.addEventListener("focus", refreshAfterDeposit);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshAfterDeposit);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load, refreshBalance]);

  const products = visibleProducts(category);
  const selectedOffer = picked ? resolveTokenShopOffer(front, picked.id) : null;
  return <section className="gh-shop" aria-label={category === "gems" ? "Gem packs" : "Premium chests"}>
    <div className="gh-shop__intro">
      <div>
        <h3>{category === "gems" ? "GEMS" : "PREMIUM CHESTS"}</h3>
        <p>{category === "gems" ? "Stock up for Marketplace equipment." : "One server-rolled equipment reward per chest."}</p>
      </div>
      <div className="gh-shop__balances">
        <div className="gh-shop__balance"><img src={ghIcon} alt="" /> GH <strong>{balanceRefreshing ? "…" : formatWholeGh(gh)}</strong></div>
        <div className="gh-shop__balance"><img src={gemIcon} alt="" /> GEMS <strong>{typeof gems === "number" ? gems.toLocaleString() : "—"}</strong></div>
        {iou > 0 ? <div className="gh-shop__balance">GH IOU <strong>{iou.toLocaleString()}</strong></div> : null}
      </div>
    </div>
    <div className="gh-shop__actions">
      <p className="gh-shop__notice">Purchases use GH already deposited into your game balance.</p>
      <button type="button" className="gh-shop__deposit" onClick={() => depositGh(client.titleID)}>Deposit GH</button>
    </div>
    {balanceError ? <p role="alert" className="gh-shop__unavailable">Could not refresh your GH balance. <button type="button" onClick={() => void refreshBalance()}>Retry</button></p> : null}
    {!balanceRefreshing && !balanceError && gh === "0" && !signedInWithIdos ?
      <p className="gh-shop__account-note">GH deposited through your iDos Games account appears only when you sign into the game with that account. <button type="button" onClick={() => client.auth.logout()}>Sign in with iDos Games</button></p> : null}
    {loadError ? <p role="alert" className="gh-shop__unavailable">{loadError} <button type="button" onClick={() => void load()}>Retry</button></p> : null}
    {loading && !front ? <div className="gh-shop__empty">Loading Shop offers…</div> :
      <div className="gh-shop__grid">{products.map((product) => {
        const offer = resolveTokenShopOffer(front, product.id);
        return <button key={product.id} type="button" disabled={!offer || offer.soldOut || !!offer.availableAtUtc}
          className={`gh-shop__card gh-shop__card--${product.rarity?.toLowerCase() ?? (product.category === "chests" ? "premium" : "gems")}`}
          onClick={() => setPicked(product)}>
          {product.badge ? <span className="gh-shop__badge">{product.badge}</span> : null}
          <span className="gh-shop__art">{artFailed[product.id] ? <span aria-hidden="true">{category === "gems" ? "◆" : "✦"}</span> :
            <img src={`${import.meta.env.BASE_URL}${product.art}`} alt="" onError={() => setArtFailed((previous) => ({ ...previous, [product.id]: true }))} />}</span>
          <span className="gh-shop__kind">{product.rarity ?? (product.category === "chests" ? "PREMIUM" : "GEMS")}</span>
          <strong>{offer ? rewardLabel(offer) : product.title}</strong>
          <span className="gh-shop__price">{offer ? `${offer.ghPrice.toLocaleString()} GH` : "Offer unavailable"}</span>
          <span className="gh-shop__card-action">{offer?.soldOut ? "SOLD OUT" : offer?.availableAtUtc ? "NOT READY" : "VIEW DETAILS"}</span>
        </button>;
      })}</div>}
    {picked && selectedOffer ? <ProductDetails key={picked.id} product={picked} offer={selectedOffer}
      artFailed={!!artFailed[picked.id]} onClose={() => setPicked(null)}
      onPurchased={() => setFront(client.store.cachedStorefront)}
      onRefresh={load} onDeposit={() => depositGh(client.titleID)} /> : null}
  </section>;
}

function ProductDetails({ product, offer, artFailed, onClose, onPurchased, onRefresh, onDeposit }: {
  product: ShopProduct; offer: ResolvedTokenOffer; artFailed: boolean;
  onClose: () => void; onPurchased: () => void; onRefresh: () => Promise<void>; onDeposit: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const gate = useRef(createTokenPurchaseGate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TokenPurchaseError | null>(null);
  const [success, setSuccess] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState(false);

  const buy = async () => {
    const outcome = await gate.current.run(async () => {
      setBusy(true);
      setError(null);
      try { return await purchaseTokenShopProduct(client, product.id, offer); }
      catch (unexpected) {
        if (import.meta.env.DEV) console.warn("GH Shop purchase failed", unexpected);
        return { ok: false as const, error: "connection" as const };
      } finally { setBusy(false); }
    });
    if (!outcome) return;
    if (!outcome.ok) {
      if (import.meta.env.DEV && outcome.detail) console.warn("GH Shop purchase rejected", outcome.detail);
      setError(outcome.error);
      if (outcome.error === "unavailable" || outcome.error === "limit") void onRefresh();
      return;
    }
    setSuccess(true);
    setRefreshWarning(!outcome.inventoryFresh || !outcome.storefrontFresh);
    onPurchased();
    toast(product.category === "gems" ? `${offer.rewardAmount.toLocaleString()} GEMS purchased.` : "Premium Chest purchased.", "success");
  };

  return <Popup title={product.title} onClose={() => { if (!gate.current.isPending()) onClose(); }}>
    <div className="gh-shop__details">
      <div className="gh-shop__detail-art">{artFailed ? <span aria-hidden="true">✦</span> : <img src={`${import.meta.env.BASE_URL}${product.art}`} alt="" />}</div>
      {product.category === "chests" ? <span className="gh-shop__kind gh-shop__kind--premium">Premium</span> : null}
      <p>{product.description}</p>
      <p>Reward: {rewardLabel(offer)}</p>
      <div className="gh-shop__detail-price">{offer.ghPrice.toLocaleString()} GH<small>Price from the iDos Store</small></div>
      {success ? <>
        <strong role="status">{product.category === "gems" ? "GEMS purchased." : "Premium Chest added to Inventory."}</strong>
        {refreshWarning ? <p>Purchase completed. Refresh the game to update the displayed balances.</p> : null}
      </> : <>
        <button type="button" className="gh-shop__buy" disabled={busy || offer.soldOut || !!offer.availableAtUtc} onClick={() => void buy()}>
          {busy ? "PURCHASING…" : offer.soldOut ? "SOLD OUT" : offer.availableAtUtc ? "NOT READY" : "BUY"}
        </button>
        {error ? <p role="alert" className="gh-shop__unavailable">{tokenPurchaseMessage(error)}</p> : null}
        {error && showDepositOnPurchaseError(error) ? <button type="button" className="gh-shop__deposit" onClick={onDeposit}>Deposit GH</button> : null}
      </>}
    </div>
  </Popup>;
}
