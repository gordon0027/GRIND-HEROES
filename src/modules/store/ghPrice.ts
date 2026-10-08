/** A display-only market reference. Checkout always uses the iDos Store's GH amount. */
export const GH_SOLANA_MINT = "2gzmu2aJtyw35ph7wQhQKTKe9G6rwD91HyjjsEcJidos";
export const GH_MARKET_ENDPOINT =
  `https://api.dexscreener.com/token-pairs/v1/solana/${GH_SOLANA_MINT}`;

export interface GhMarketQuote {
  usdPerGh: number;
  pairAddress: string;
  observedAt: number;
}

export function selectGhMarketQuote(payload: unknown, observedAt = Date.now()): GhMarketQuote | null {
  if (!Array.isArray(payload)) return null;
  const valid = payload.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const pair = value as {
      chainId?: unknown; baseToken?: { address?: unknown }; priceUsd?: unknown;
      pairAddress?: unknown; liquidity?: { usd?: unknown } | null;
    };
    const price = typeof pair.priceUsd === "string" ? Number(pair.priceUsd) : NaN;
    if (pair.chainId !== "solana" || pair.baseToken?.address !== GH_SOLANA_MINT ||
        !Number.isFinite(price) || price <= 0 || typeof pair.pairAddress !== "string" ||
        !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pair.pairAddress)) return [];
    const liquidity = Number(pair.liquidity?.usd);
    return [{ usdPerGh: price, pairAddress: pair.pairAddress,
      liquidity: Number.isFinite(liquidity) && liquidity > 0 ? liquidity : 0 }];
  });
  valid.sort((a, b) => b.liquidity - a.liquidity);
  const best = valid[0];
  return best ? { usdPerGh: best.usdPerGh, pairAddress: best.pairAddress, observedAt } : null;
}

export async function fetchGhMarketQuote(signal?: AbortSignal): Promise<GhMarketQuote | null> {
  const response = await fetch(GH_MARKET_ENDPOINT, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`GH market quote HTTP ${response.status}`);
  return selectGhMarketQuote(await response.json());
}

export function formatGhUsd(gh: number, quote: GhMarketQuote): string {
  const usd = gh * quote.usdPerGh;
  if (!Number.isFinite(usd) || usd <= 0) return "—";
  const digits = usd >= 1 ? 2 : usd >= 0.01 ? 4 : usd >= 0.0001 ? 6 : 8;
  return usd < 0.00000001 ? `$${usd.toExponential(2)}` :
    `$${usd.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}`;
}

export function ghMarketPairUrl(quote: GhMarketQuote): string {
  return `https://dexscreener.com/solana/${quote.pairAddress}`;
}
