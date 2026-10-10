export function wholeGh(value: unknown): bigint | null {
  return typeof value === "string" && /^(0|[1-9][0-9]*)(?:\.0+)?$/.test(value)
    ? BigInt(value.split(".")[0]!) : null;
}

export async function waitForAuthoritativeGh(
  expected: bigint,
  read: () => Promise<bigint>,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { if (await read() === expected) return true; }
    catch { /* The next authoritative inventory read may succeed. */ }
    if (attempt < 4) await pause(400 * (attempt + 1));
  }
  return false;
}
