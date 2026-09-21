import type { AppLocale, Currency, RateType } from "@/lib/database.types";
import { formatColumn } from "@/lib/money";

function intlLocale(locale: AppLocale): string {
  return locale === "fr" ? "fr-FR" : "en-GB";
}

/** Parse a `date` column ("2026-03-09") without letting the timezone shift it. */
export function parseDateColumn(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(value: string | null, locale: AppLocale): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseDateColumn(value));
}

export function formatDateLong(value: string | null, locale: AppLocale): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateColumn(value));
}

/** Today in the browser's or server's local zone, as a `date` column value. */
export function todayColumn(base = new Date()): string {
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "650 TND per day" / "650 TND par jour" */
export function formatRate(
  amount: string,
  rateType: RateType,
  currency: Currency,
  locale: AppLocale,
  unitWords: Record<RateType, string>,
): string {
  const money = formatColumn(amount, currency, locale);
  return `${money} ${unitWords[rateType]}`;
}
