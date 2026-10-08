/** The only TOKEN purchase boundary. A later server order adapter replaces this implementation. */
import { shopCatalog } from "./shopCatalog.ts";
export type TokenPurchaseResult =
  | { status: "unavailable"; code: "TOKEN_PROVIDER_NOT_IMPLEMENTED" }
  | { status: "failed"; code: "PRODUCT_UNAVAILABLE" };

export function requestTokenPurchase(productID: string): TokenPurchaseResult {
  if (!shopCatalog.some((product) => product.id === productID && product.enabled))
    return { status: "failed", code: "PRODUCT_UNAVAILABLE" };
  return { status: "unavailable", code: "TOKEN_PROVIDER_NOT_IMPLEMENTED" };
}
