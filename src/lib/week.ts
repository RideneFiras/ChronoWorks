import { parseDateColumn, todayColumn } from "@/lib/format";

/** Weeks start on Monday: both launch markets use it. */
export const WEEK_DAYS = 7;

export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - weekday);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

export function toColumnDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The seven dates of the week that `anchor` falls in. */
export function weekDates(anchor: string | null): string[] {
  const base = anchor ? parseDateColumn(anchor) : new Date();
  const monday = startOfWeek(base);
  return Array.from({ length: WEEK_DAYS }, (_, i) => toColumnDate(addDays(monday, i)));
}

export function shiftWeek(anchor: string, weeks: number): string {
  return toColumnDate(addDays(parseDateColumn(anchor), weeks * 7));
}

export function isWeekend(columnDate: string): boolean {
  const day = parseDateColumn(columnDate).getDay();
  return day === 0 || day === 6;
}

export function thisWeekAnchor(): string {
  return toColumnDate(startOfWeek(new Date()));
}

export { todayColumn };
