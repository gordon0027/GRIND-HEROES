import type { IDosGamesClient } from "@idosgames/core";

export interface TokenQuote {
  productId: string;
  productType: "GEMS" | "PREMIUM_CHEST";
  tokenCurrencyId: string;
  tokenNetwork: string;
  tokenMint: string;
  tokenDecimals: number;
  tokenAmountBaseUnits: string;
  rewardType: "GEMS" | "PREMIUM_CHEST";
  rewardReference: string;
  rewardAmount: number;
  lootboxId: string | null;
}

export interface TokenOrder extends TokenQuote {
  orderId: string;
  status: "CREATED" | "AWAITING_PAYMENT" | "PAYMENT_SUBMITTED" | "CONFIRMED" |
    "FULFILLED" | "FAILED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid order response");
  return value as Record<string, unknown>;
}

function quote(value: unknown): TokenQuote {
  const data = record(value);
  if (typeof data.productId !== "string" || typeof data.tokenMint !== "string" ||
    data.tokenCurrencyId !== "Main" || data.tokenNetwork !== "solana" ||
    !Number.isSafeInteger(data.tokenDecimals) || Number(data.tokenDecimals) < 0 ||
    !/^[1-9][0-9]*$/.test(String(data.tokenAmountBaseUnits)) ||
    !["GEMS", "PREMIUM_CHEST"].includes(String(data.productType)) ||
    data.rewardType !== data.productType || typeof data.rewardReference !== "string" ||
    !Number.isSafeInteger(data.rewardAmount) || Number(data.rewardAmount) < 1 ||
    !(data.lootboxId === null || typeof data.lootboxId === "string"))
    throw new Error("Invalid server product terms");
  return data as unknown as TokenQuote;
}

async function execute(client: IDosGamesClient, name: string, args: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await client.cloudCode.execute(name, args);
  if (!response.ok) throw new Error(String(response.error ?? response.reason ?? "Server unavailable"));
  if (response.data.Error) throw new Error(String(response.data.Error.Message ?? response.data.Error.Error ?? "Order server error"));
  return record(response.data.FunctionResult);
}

export async function getTokenShopCatalog(client: IDosGamesClient): Promise<TokenQuote[]> {
  const result = await execute(client, "getTokenShopCatalog", {});
  if (!Array.isArray(result.products)) throw new Error("Invalid server catalog");
  return result.products.map(quote);
}

/** The public create request contains only productId and a retry-stable UUID. */
export async function createTokenPurchaseOrder(
  client: IDosGamesClient, productId: string, idempotencyKey: string,
): Promise<TokenOrder> {
  const result = await execute(client, "createTokenPurchaseOrder", { productId, idempotencyKey });
  if (result.created !== true) throw new Error(String(result.reason ?? "Order rejected"));
  const data = record(result.order);
  const terms = quote(data);
  if (typeof data.orderId !== "string" || !/^ghord_[0-9a-f]{32}$/.test(data.orderId) ||
    data.productId !== productId || typeof data.status !== "string" ||
    typeof data.createdAt !== "string" || typeof data.expiresAt !== "string")
    throw new Error("Invalid server order");
  return { ...terms, orderId: data.orderId, status: data.status as TokenOrder["status"],
    createdAt: data.createdAt, expiresAt: data.expiresAt };
}

export async function getTokenPurchaseOrder(client: IDosGamesClient, orderId: string): Promise<TokenOrder | null> {
  const result = await execute(client, "getTokenPurchaseOrder", { orderId });
  if (result.found === false) return null;
  if (result.found !== true) throw new Error("Invalid order lookup");
  const data = record(result.order);
  const terms = quote(data);
  if (data.orderId !== orderId || typeof data.status !== "string" ||
    typeof data.createdAt !== "string" || typeof data.expiresAt !== "string")
    throw new Error("Invalid server order");
  return { ...terms, orderId, status: data.status as TokenOrder["status"],
    createdAt: data.createdAt, expiresAt: data.expiresAt };
}

export function formatTokenBaseUnits(amount: string, decimals: number): string {
  if (!/^[0-9]+$/.test(amount) || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error("Invalid token amount");
  if (decimals === 0) return amount;
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
