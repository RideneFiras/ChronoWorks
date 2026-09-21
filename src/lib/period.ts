import { startOfWeek, toColumnDate } from "@/lib/week";

/** How far back a total reaches. "all" has no bounds. */
export const PERIODS = ["week", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = "month";

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

export function readPeriod(value: unknown): Period {
  return isPeriod(value) ? value : DEFAULT_PERIOD;
}

/**
 * The date_column bounds for a period, inclusive. The current week runs Monday
 * to Sunday, the same as the Week grid, so the two agree on what "this week"
 * means.
 */
export function periodRange(
  period: Period,
  today = new Date(),
): { from: string | null; to: string | null } {
  if (period === "all") return { from: null, to: null };

  if (period === "week") {
    const monday = startOfWeek(today);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { from: toColumnDate(monday), to: toColumnDate(sunday) };
  }

  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toColumnDate(first), to: toColumnDate(last) };
  }

  const first = new Date(today.getFullYear(), 0, 1);
  const last = new Date(today.getFullYear(), 11, 31);
  return { from: toColumnDate(first), to: toColumnDate(last) };
}

/** Applies the bounds to a time_entries query. */
export function withinPeriod<T extends { entry_date: string }>(
  rows: T[],
  period: Period,
  today = new Date(),
): T[] {
  const { from, to } = periodRange(period, today);
  if (!from || !to) return rows;
  return rows.filter((r) => r.entry_date >= from && r.entry_date <= to);
}
