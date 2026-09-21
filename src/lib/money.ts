/**
 * Money. CLAUDE.md rule 5: `numeric` in the database, strings or integers of
 * minor units in code, never floats.
 *
 * Everything here works on bigint scaled to SCALE decimal places, which matches
 * numeric(14,3) in the schema. Values cross the wire as decimal strings.
 */

import type { AppLocale, Currency } from "@/lib/database.types";

/** Storage scale of every money column in the schema. */
export const SCALE = 3;

/** How many decimals the currency is written with. TND uses 3, the rest 2. */
export function currencyDecimals(currency: Currency): number {
  return currency === "TND" ? 3 : 2;
}

const TEN = 10n;

function pow10(n: number): bigint {
  let r = 1n;
  for (let i = 0; i < n; i++) r *= TEN;
  return r;
}

/** Parse a decimal string (or a user-typed "1 234,50") into scaled minor units. */
export function parseAmount(input: string, scale = SCALE): bigint | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned) || !/\d/.test(cleaned)) return null;

  const negative = cleaned.startsWith("-");
  const body = negative ? cleaned.slice(1) : cleaned;
  const [whole = "0", fraction = ""] = body.split(".");

  // more decimals than we store is a typo, not a rounding job
  if (fraction.length > scale) return null;

  const padded = fraction.padEnd(scale, "0");
  const value = BigInt(whole || "0") * pow10(scale) + BigInt(padded || "0");
  return negative ? -value : value;
}

/** Read a numeric column coming back from PostgREST. */
export function fromColumn(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  return parseAmount(String(value)) ?? 0n;
}

/** Render scaled minor units as the decimal string a numeric column expects. */
export function toColumn(value: bigint, scale = SCALE): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const unit = pow10(scale);
  const whole = abs / unit;
  const fraction = (abs % unit).toString().padStart(scale, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** a * b where both are scaled, rounded half-up back to `scale`. */
export function multiply(a: bigint, b: bigint, scale = SCALE): bigint {
  const unit = pow10(scale);
  const product = a * b;
  return roundDiv(product, unit);
}

/** Percentage of an amount, e.g. VAT at 19.00 -> rate scaled by 100. */
export function percentOf(amount: bigint, ratePercent: bigint): bigint {
  // ratePercent is scaled by 100 (tax_rate is numeric(5,2))
  return roundDiv(amount * ratePercent, 10000n);
}

function roundDiv(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const quotient = abs / denominator;
  const remainder = abs % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

function separators(locale: AppLocale): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    useGrouping: true,
    minimumFractionDigits: 1,
  }).formatToParts(1234.5);
  const group = parts.find((p) => p.type === "group")?.value ?? ",";
  return {
    // French grouping is U+202F NARROW NO-BREAK SPACE, which Hanken Grotesk
    // has no glyph for: the invoice PDF dropped it and amounts ran into the
    // next column. U+00A0 is the same convention and is in the font.
    group: group === " " ? " " : group,
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/**
 * Format scaled minor units for display. Grouping and the decimal mark come
 * from Intl, the digits come from the exact integer: no float ever touches the
 * amount.
 */
export function formatAmount(
  value: bigint,
  currency: Currency,
  locale: AppLocale,
): string {
  const decimals = currencyDecimals(currency);
  const rescaled = rescale(value, SCALE, decimals);
  const { group, decimal } = separators(locale);

  const negative = rescaled < 0n;
  const abs = negative ? -rescaled : rescaled;
  const unit = pow10(decimals);
  const whole = (abs / unit).toString();
  const fraction = (abs % unit).toString().padStart(decimals, "0");

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const body = decimals > 0 ? `${grouped}${decimal}${fraction}` : grouped;
  return `${negative ? "-" : ""}${body}`;
}

/** Amount plus its currency code, e.g. "1 240,00 EUR". */
export function formatMoney(
  value: bigint,
  currency: Currency,
  locale: AppLocale,
): string {
  return `${formatAmount(value, currency, locale)} ${currency}`;
}

function rescale(value: bigint, from: number, to: number): bigint {
  if (to === from) return value;
  if (to > from) return value * pow10(to - from);
  return roundDiv(value, pow10(from - to));
}

/** Convenience for the common "string column in, display string out" path. */
export function formatColumn(
  value: string | number | null | undefined,
  currency: Currency,
  locale: AppLocale,
): string {
  return formatMoney(fromColumn(value), currency, locale);
}
