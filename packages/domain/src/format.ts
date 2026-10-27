import type { Money } from "./money";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const idrPlain = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

/** Format whole rupiah as Indonesian currency, e.g. `Rp1.500.000`. */
export function formatMoney(amount: Money): string {
  return idr.format(amount);
}

/** Format whole rupiah without the currency symbol, e.g. `1.500.000`. */
export function formatAmount(amount: Money): string {
  return idrPlain.format(amount);
}

/**
 * Compact Indonesian shorthand for a money amount, e.g. `1,5 jt`. Used for
 * tight UI spots and summaries.
 */
export function formatMoneyCompact(amount: Money): string {
  const abs = amount < 0n ? -amount : amount;
  const sign = amount < 0n ? "-" : "";
  if (abs >= 1_000_000n) {
    const whole = abs / 1_000_000n;
    const frac = ((abs % 1_000_000n) * 10n) / 1_000_000n;
    return `${sign}${whole}${frac > 0n ? `,${frac}` : ""} jt`;
  }
  if (abs >= 1_000n) {
    const whole = abs / 1_000n;
    const frac = ((abs % 1_000n) * 10n) / 1_000n;
    return `${sign}${whole}${frac > 0n ? `,${frac}` : ""} rb`;
  }
  return `${sign}${abs}`;
}
