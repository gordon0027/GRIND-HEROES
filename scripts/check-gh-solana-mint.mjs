// Read-only preflight for the GH SPL mint. This script never signs or sends a transaction.
import { pathToFileURL } from "node:url";

export const GH_MINT = "2gzmu2aJtyw35ph7wQhQKTKe9G6rwD91HyjjsEcJidos";
export const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const GH_ON_CHAIN_DECIMALS = 6;

export async function checkGhSolanaMint(fetchImpl = fetch, rpcUrl = "https://api.mainnet-beta.solana.com") {
  async function read(method, params) {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`solana_rpc_http_${response.status}`);
    const body = await response.json();
    if (body.error || !body.result) throw new Error(`solana_rpc_${method}_failed`);
    return body.result;
  }

  const account = await read("getAccountInfo", [GH_MINT,
    { encoding: "jsonParsed", commitment: "finalized" }]);
  const value = account.value;
  const info = value?.data?.parsed?.info;
  if (!value || value.owner !== SPL_TOKEN_PROGRAM ||
      value.data?.parsed?.type !== "mint" || info?.isInitialized !== true)
    throw new Error("gh_mint_is_not_initialized_legacy_spl_token");
  if (info.decimals !== GH_ON_CHAIN_DECIMALS)
    throw new Error(`gh_mint_decimals_changed:${info.decimals}`);

  const supply = await read("getTokenSupply", [GH_MINT, { commitment: "finalized" }]);
  if (supply.value?.decimals !== info.decimals ||
      supply.value?.amount !== info.supply)
    throw new Error("gh_mint_account_and_supply_disagree");
  return {
    mint: GH_MINT,
    tokenProgram: value.owner,
    onChainDecimals: info.decimals,
    baseUnitsPerGh: (10n ** BigInt(info.decimals)).toString(),
    wholeTokenSupply: supply.value.uiAmountString,
    mintAuthorityPresent: info.mintAuthority !== null,
    accountSlot: account.context?.slot,
    supplySlot: supply.context?.slot,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkGhSolanaMint();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
