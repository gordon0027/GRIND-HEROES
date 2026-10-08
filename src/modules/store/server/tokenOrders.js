// Concatenate after the live Grind Heroes CloudCode source. No client imports.
// Prices are whole tokens; the configured Solana decimals turn them into base-unit strings.
var GH_TOKEN_ORDER_COLLECTION = "gh_token_orders_v1";
var GH_TOKEN_ORDER_TTL_MS = 20 * 60 * 1000;
var GH_TOKEN_PRODUCTS = {
  gems_small: { enabled: true, type: "GEMS", tokenPrice: 5, rewardReference: "GEMS", rewardAmount: 500 },
  gems_medium: { enabled: true, type: "GEMS", tokenPrice: 12, rewardReference: "GEMS", rewardAmount: 1200 },
  gems_large: { enabled: true, type: "GEMS", tokenPrice: 30, rewardReference: "GEMS", rewardAmount: 3000 },
  premium_chest_v1: { enabled: true, type: "PREMIUM_CHEST", tokenPrice: 20,
    rewardReference: "premium_chest_v1", rewardAmount: 1, lootboxID: "premium_equipment_v1" },
  chest_rare: { enabled: false },
  chest_legendary: { enabled: false },
};

function ghTokenOrderConfig() {
  var response = server.GetTitleConfig("Currency", "Item", "Lootbox");
  if (!response || response.Success === false) throw new Error("TOKEN_CONFIG_UNAVAILABLE");
  var root = response.Data || response;
  var currency = root.Currency && root.Currency.CryptoCurrencies && root.Currency.CryptoCurrencies.Main;
  var network = currency && (currency.Networks || []).filter(function (entry) {
    return entry.NetworkID === "solana";
  })[0];
  if (!currency || currency.Status !== "Active" || !network ||
      !network.ContractAddress || !Number.isSafeInteger(network.Decimals) ||
      network.Decimals < 0 || network.Decimals > 18) throw new Error("TOKEN_CONFIG_UNAVAILABLE");
  return { root: root, currency: currency, network: network };
}

function ghTokenProduct(productID, config) {
  var product = Object.prototype.hasOwnProperty.call(GH_TOKEN_PRODUCTS, productID)
    ? GH_TOKEN_PRODUCTS[productID] : null;
  if (!product) return { error: "PRODUCT_UNKNOWN" };
  if (!product.enabled) return { error: "PRODUCT_DISABLED" };
  if (product.type === "GEMS") {
    var gems = config.root.Currency && config.root.Currency.VirtualCurrencies &&
      config.root.Currency.VirtualCurrencies.GEMS;
    if (!gems || gems.Status !== "Active") throw new Error("GEMS_CONFIG_UNAVAILABLE");
  } else {
    var item = config.root.Item && config.root.Item.Catalogs && config.root.Item.Catalogs.Item &&
      config.root.Item.Catalogs.Item.Items &&
      config.root.Item.Catalogs.Item.Items[product.rewardReference];
    var lootbox = config.root.Lootbox && config.root.Lootbox.Definitions &&
      config.root.Lootbox.Definitions[product.lootboxID];
    if (!item || !lootbox) throw new Error("PREMIUM_CHEST_CONFIG_UNAVAILABLE");
  }
  return { product: product };
}

function ghTokenBaseUnits(whole, decimals) {
  if (!Number.isSafeInteger(whole) || whole <= 0) throw new Error("TOKEN_PRICE_INVALID");
  return String(whole) + Array(decimals + 1).join("0");
}

function ghTokenOrderPublic(orderID, data, now) {
  var expires = new Date(data.expiresAt).getTime();
  var status = data.status;
  if ((status === "CREATED" || status === "AWAITING_PAYMENT") &&
      isFinite(expires) && now >= expires) status = "EXPIRED";
  return {
    orderId: orderID,
    productId: data.productId,
    productType: data.productType,
    tokenCurrencyId: data.tokenCurrencyId,
    tokenNetwork: data.tokenNetwork,
    tokenMint: data.tokenMint,
    tokenDecimals: data.tokenDecimals,
    tokenAmountBaseUnits: data.tokenAmountBaseUnits,
    rewardType: data.rewardType,
    rewardReference: data.rewardReference,
    rewardAmount: data.rewardAmount,
    lootboxId: data.lootboxId || null,
    status: status,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
  };
}

function ghTokenStoredData(response) {
  if (!response || response.Success === false) return null;
  var item = response.Data && (response.Data.Item || response.Data);
  return item && (item.Data || item.Fields || item);
}

function ghTokenReadOwnOrder(orderID, context) {
  var response = server.GetDataItem(GH_TOKEN_ORDER_COLLECTION, orderID);
  var data = ghTokenStoredData(response);
  if (!data || data.playerId !== context.UserID) return null;
  return data;
}

function ghTokenAllowedTransition(from, to) {
  var next = {
    CREATED: ["AWAITING_PAYMENT", "EXPIRED", "FAILED"],
    AWAITING_PAYMENT: ["PAYMENT_SUBMITTED", "EXPIRED", "FAILED"],
    PAYMENT_SUBMITTED: ["CONFIRMED", "FAILED"],
    CONFIRMED: ["FULFILLED", "FAILED"],
    FULFILLED: [], FAILED: [], EXPIRED: [],
  };
  return !!next[from] && next[from].indexOf(to) >= 0;
}

handlers.getTokenShopCatalog = function () {
  var config = ghTokenOrderConfig();
  var products = [];
  Object.keys(GH_TOKEN_PRODUCTS).forEach(function (productID) {
    var resolved = ghTokenProduct(productID, config);
    if (resolved.error) return;
    var product = resolved.product;
    products.push({ productId: productID, productType: product.type,
      tokenCurrencyId: "Main", tokenNetwork: "solana",
      tokenMint: config.network.ContractAddress,
      tokenDecimals: config.network.Decimals,
      tokenAmountBaseUnits: ghTokenBaseUnits(product.tokenPrice, config.network.Decimals),
      rewardType: product.type, rewardReference: product.rewardReference,
      rewardAmount: product.rewardAmount, lootboxId: product.lootboxID || null });
  });
  return { products: products };
};

handlers.createTokenPurchaseOrder = function (args, context) {
  if (!context || !context.UserID) throw new Error("AUTH_REQUIRED");
  var keys = args && typeof args === "object" && !Array.isArray(args) ? Object.keys(args) : [];
  if (keys.length !== 2 || keys.indexOf("productId") < 0 || keys.indexOf("idempotencyKey") < 0)
    return { created: false, reason: "INVALID_REQUEST" };
  var productID = args.productId;
  var key = args.idempotencyKey;
  if (typeof productID !== "string" || typeof key !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))
    return { created: false, reason: "INVALID_REQUEST" };
  var config = ghTokenOrderConfig();
  var resolved = ghTokenProduct(productID, config);
  if (resolved.error) return { created: false, reason: resolved.error };
  var orderID = "ghord_" + key.replace(/-/g, "").toLowerCase();
  var previous = ghTokenReadOwnOrder(orderID, context);
  if (previous) {
    if (previous.productId !== productID || previous.idempotencyKey !== key.toLowerCase())
      return { created: false, reason: "IDEMPOTENCY_CONFLICT" };
    return { created: true, reused: true,
      order: ghTokenOrderPublic(orderID, previous, new Date(context.InvokedAt).getTime()) };
  }
  var now = new Date(context.InvokedAt).getTime();
  if (!isFinite(now)) throw new Error("SERVER_TIME_UNAVAILABLE");
  var product = resolved.product;
  var snapshot = {
    playerId: context.UserID,
    idempotencyKey: key.toLowerCase(),
    productId: productID,
    productType: product.type,
    tokenCurrencyId: "Main",
    tokenNetwork: "solana",
    tokenMint: config.network.ContractAddress,
    tokenDecimals: config.network.Decimals,
    tokenAmountBaseUnits: ghTokenBaseUnits(product.tokenPrice, config.network.Decimals),
    rewardType: product.type,
    rewardReference: product.rewardReference,
    rewardAmount: product.rewardAmount,
    lootboxId: product.lootboxID || "",
    status: "CREATED",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + GH_TOKEN_ORDER_TTL_MS).toISOString(),
  };
  var saved = server.CreateDataItem(GH_TOKEN_ORDER_COLLECTION, snapshot, orderID, context.UserID);
  if (!saved || !saved.Success) throw new Error("ORDER_CREATE_FAILED: " + (saved && saved.Error || "unknown"));
  if (saved.Data && saved.Data.AlreadyExists) {
    var existing = ghTokenReadOwnOrder(orderID, context);
    if (!existing || existing.productId !== productID || existing.idempotencyKey !== key.toLowerCase())
      return { created: false, reason: "IDEMPOTENCY_CONFLICT" };
    return { created: true, reused: true, order: ghTokenOrderPublic(orderID, existing, now) };
  }
  return { created: true, reused: false, order: ghTokenOrderPublic(orderID, snapshot, now) };
};

handlers.getTokenPurchaseOrder = function (args, context) {
  if (!context || !context.UserID) throw new Error("AUTH_REQUIRED");
  var orderID = args && args.orderId;
  if (typeof orderID !== "string" || !/^ghord_[0-9a-f]{32}$/.test(orderID))
    return { found: false };
  var data = ghTokenReadOwnOrder(orderID, context);
  return data ? { found: true,
    order: ghTokenOrderPublic(orderID, data, new Date(context.InvokedAt).getTime()) } : { found: false };
};
