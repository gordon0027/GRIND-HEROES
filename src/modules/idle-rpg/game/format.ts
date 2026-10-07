// Idle-game numbers: they outgrow "1.2M" within an hour, so after the usual K/M/B/T come the
// two-letter units of the genre — aa, ab, … az, ba, … (Legend Slime's "1.36J" is the same idea).

const SMALL = ["", "K", "M", "B", "T"];

/** 950 → "950", 12_300 → "12.3K", 4.5e15 → "4.50aa". Never longer than ~6 characters. */
export function formatBig(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  const sign = value < 0 ? "-" : "";
  let n = Math.abs(value);
  if (n < 1000) return sign + (Number.isInteger(n) ? String(n) : trim(n, 1));
  let unit = 0;
  while (n >= 1000) {
    n /= 1000;
    unit++;
  }
  return sign + trim(n, n < 10 ? 2 : n < 100 ? 1 : 0) + unitName(unit);
}

function unitName(unit: number): string {
  const small = SMALL[unit];
  if (small !== undefined) return small;
  const k = unit - SMALL.length;
  const a = "a".charCodeAt(0);
  return (
    String.fromCharCode(a + (Math.floor(k / 26) % 26)) +
    String.fromCharCode(a + (k % 26))
  );
}

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.?0+$/, "");
}

/** A stat value as the Enhance list shows it: chances as percent, small values with decimals. */
export function formatStat(value: number, percent: boolean): string {
  if (percent) return `${trim(value * 100, 1)}%`;
  if (Math.abs(value) < 100 && !Number.isInteger(value)) return trim(value, 2);
  return formatBig(Math.round(value));
}

/** 3725 s → "1h 2m", 95 s → "1m 35s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
