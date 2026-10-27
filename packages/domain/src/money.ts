/**
 * Integer money for Cashow.
 *
 * The plan's first data-integrity rule: whole rupiah as 64-bit integers.
 * Amounts are always positive and the transaction type gives the sign, so the
 * domain uses `bigint` everywhere and never `number` for money.
 */

/** Whole rupiah, stored as a 64-bit integer (`bigint`). */
export type Money = bigint;

export const ZERO: Money = 0n;

/** Indonesian shorthand suffixes to their multiplier. */
const SUFFIXES: Readonly<Record<string, bigint>> = {
  "": 1n,
  k: 1_000n,
  rb: 1_000n,
  ribu: 1_000n,
  jt: 1_000_000n,
  juta: 1_000_000n,
  m: 1_000_000n,
  mio: 1_000_000n,
};

/**
 * Validate a thousands-separated group sequence: the leading group has 1-3
 * digits and every following group has exactly 3 digits (`1.500.000`).
 * Returns the digits joined together, or null when malformed.
 */
function joinThousandsGroups(groups: string[]): string | null {
  const first = groups[0];
  if (first === undefined || first === "" || first.length > 3 || !/^\d+$/.test(first)) {
    return null;
  }
  for (let i = 1; i < groups.length; i++) {
    const group = groups[i];
    if (group === undefined || group.length !== 3 || !/^\d{3}$/.test(group)) {
      return null;
    }
  }
  return groups.join("");
}

/**
 * Normalize thousand/decimal separators into a canonical `integer.fraction`
 * form. Follows Indonesian number conventions:
 * - both `,` and `.` present: the last separator is the decimal point.
 * - a single separator whose trailing group has exactly 3 digits is a
 *   thousands separator (`1.500` -> 1500); otherwise it is a decimal point
 *   (`1,5` -> 1.5).
 * - multiple identical separators are thousands separators (`1.500.000`).
 */
function normalizeSeparators(s: string): string | null {
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // dots are thousands, the last comma is the decimal point
      const intPart = joinThousandsGroups(s.slice(0, lastComma).split("."));
      if (intPart === null) return null;
      return `${intPart}.${s.slice(lastComma + 1)}`;
    }
    // commas are thousands, the last dot is the decimal point
    const intPart = joinThousandsGroups(s.slice(0, lastDot).split(","));
    if (intPart === null) return null;
    return `${intPart}.${s.slice(lastDot + 1)}`;
  }
  const sep = hasComma ? "," : hasDot ? "." : null;
  if (sep === null) return s;
  const groups = s.split(sep);
  if (groups.length > 2) return joinThousandsGroups(groups);
  const trailing = groups[1] ?? "";
  if (trailing.length === 3) {
    // Treat as thousands only when the leading group is 1-3 digits.
    return joinThousandsGroups(groups);
  }
  return groups.join(".");
}

/** Parse a signed decimal into a scaled integer (`value * 10^scale`). */
function parseDecimalToScaled(s: string): { scaled: bigint; scale: number } | null {
  const negative = s.startsWith("-");
  const body = s.replace(/^[+-]/, "");
  const normalized = normalizeSeparators(body);
  if (normalized === null) return null;
  const parts = normalized.split(".");
  if (parts.length > 2) return null;
  const intPart = parts[0] === "" ? "0" : (parts[0] as string);
  const fracPart = parts[1] ?? "";
  if (!/^\d+$/.test(intPart)) return null;
  if (fracPart !== "" && !/^\d+$/.test(fracPart)) return null;
  const scaled = BigInt(intPart + fracPart);
  return { scaled: negative ? -scaled : scaled, scale: fracPart.length };
}

/**
 * Parse a user-entered money string into whole rupiah.
 *
 * Accepts `35000`, `35k`, `35rb`, `1,5jt`, `1.5jt`, `Rp 35.000`, `-1jt`.
 * Returns `null` when the input cannot be parsed into a money amount.
 */
export function parseMoney(input: string): Money | null {
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/^rp\s*\.?\s*/, "");
  if (raw === "") return null;
  const match = raw.match(/^([+-]?[\d.,]+)\s*([a-z]*)$/);
  if (match === null) return null;
  const numberPart = match[1] as string;
  const suffix = match[2] ?? "";
  const multiplier = SUFFIXES[suffix];
  if (multiplier === undefined) return null;
  const parsed = parseDecimalToScaled(numberPart);
  if (parsed === null) return null;
  const factor = 10n ** BigInt(parsed.scale);
  const abs = parsed.scaled < 0n ? -parsed.scaled : parsed.scaled;
  let result = (abs * multiplier) / factor;
  const remainder = (abs * multiplier) % factor;
  if (remainder * 2n >= factor) result += 1n; // round half up
  return parsed.scaled < 0n ? -result : result;
}

/** True when the value is a positive whole rupiah amount. */
export function isPositiveMoney(amount: Money): boolean {
  return amount > 0n;
}

/** Sum of a list of money values. */
export function sumMoney(values: readonly Money[]): Money {
  let total = ZERO;
  for (const value of values) total += value;
  return total;
}

/** `a - b` clamped at zero (never returns a negative money value). */
export function subMoneyNonNegative(a: Money, b: Money): Money {
  const diff = a - b;
  return diff < 0n ? ZERO : diff;
}
