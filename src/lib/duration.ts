/**
 * Durations. Stored as whole minutes everywhere (PRD section 6).
 * The Week grid accepts `2`, `2h`, `1h30`, `90m`, and `0.5d` on daily-rate
 * projects (DESIGN.md section 6).
 */

export const DEFAULT_HOURS_PER_DAY = 8;

export interface DurationContext {
  /** From profiles.hours_per_day. */
  hoursPerDay: number;
  /** Daily-rate projects accept and display days. */
  allowDays: boolean;
}

/**
 * Returns whole minutes, or null when the text is not a duration we accept.
 * Zero is rejected: clearing a cell deletes the entry instead.
 */
export function parseDuration(
  input: string,
  { hoursPerDay, allowDays }: DurationContext,
): number | null {
  const text = input.trim().toLowerCase().replace(",", ".").replace(/\s/g, "");
  if (text === "") return null;

  // 1h30 / 1h / 1h00
  const hm = /^(\d+)h(\d{1,2})?$/.exec(text);
  if (hm) {
    const hours = Number(hm[1]);
    const minutes = hm[2] === undefined ? 0 : Number(hm[2].padEnd(2, "0"));
    if (minutes > 59) return null;
    return round(hours * 60 + minutes);
  }

  // 90m
  const m = /^(\d+(?:\.\d+)?)m$/.exec(text);
  if (m) return round(Number(m[1]));

  // 0.5d
  const d = /^(\d+(?:\.\d+)?)d$/.exec(text);
  if (d) {
    if (!allowDays) return null;
    return round(Number(d[1]) * hoursPerDay * 60);
  }

  // bare number means hours: 2 or 2.5
  const plain = /^(\d+(?:\.\d+)?)h?$/.exec(text);
  if (plain) return round(Number(plain[1]) * 60);

  return null;
}

function round(minutes: number): number | null {
  if (!Number.isFinite(minutes)) return null;
  const value = Math.round(minutes);
  if (value <= 0 || value > 1440) return null;
  return value;
}

/** "4h", "1h30", "45m" */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** "1.5 d" rendered with the locale's decimal mark, trailing zeros trimmed. */
export function formatDays(minutes: number, hoursPerDay: number, locale: string): string {
  const days = minutes / (hoursPerDay * 60);
  const text = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    maximumFractionDigits: 2,
  }).format(days);
  return `${text} d`;
}

/**
 * What a cell shows.
 *
 * Day-rate projects are read in days (DESIGN.md section 6), but only once
 * there is a whole day to show: half an afternoon rendered as "0,19 d" is not
 * something anyone reads at a glance, so anything under a full day stays in
 * hours. Hourly and fixed projects are always hours.
 */
export function formatDuration(
  minutes: number,
  { hoursPerDay, allowDays }: DurationContext,
  locale: string,
): string {
  if (minutes <= 0) return "";
  if (!allowDays) return formatHours(minutes);
  return minutes >= hoursPerDay * 60
    ? formatDays(minutes, hoursPerDay, locale)
    : formatHours(minutes);
}

/** Minutes to a decimal quantity string for an invoice line. */
export function minutesToQuantity(
  minutes: number,
  unit: "day" | "hour" | "unit",
  hoursPerDay: number,
): string {
  if (unit === "day") return (minutes / (hoursPerDay * 60)).toFixed(3);
  if (unit === "hour") return (minutes / 60).toFixed(3);
  return "1.000";
}

export function hoursPerDayFrom(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOURS_PER_DAY;
}
