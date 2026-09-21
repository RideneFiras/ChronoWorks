"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { addDays, startOfWeek, toColumnDate } from "@/lib/week";
import { todayColumn } from "@/lib/format";
import type { AppLocale, LeaveRow } from "@/lib/database.types";

const tone: Record<string, string> = {
  vacation: "bg-green-tint text-green",
  sick: "bg-red-tint text-red",
  other: "bg-raised text-ink-muted",
  public_holiday: "bg-brass-tint text-brass",
};

/** Month view. Leave days carry the tint of their type, always with the word
 *  in the day's title, never colour alone (DESIGN.md section 10). */
export function LeaveCalendar({
  leaves,
  locale,
  onPick,
}: {
  leaves: LeaveRow[];
  locale: AppLocale;
  onPick: (date: string) => void;
}) {
  const t = useTranslations("leave");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const monthLabel = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }).format(cursor);

  // Six weeks from the Monday on or before the 1st covers every month.
  const gridStart = startOfWeek(cursor);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const byDay = new Map<string, LeaveRow>();
  for (const leave of leaves) {
    let d = new Date(`${leave.start_date}T00:00:00`);
    const end = new Date(`${leave.end_date}T00:00:00`);
    while (d <= end) {
      byDay.set(toColumnDate(d), leave);
      d = addDays(d, 1);
    }
  }

  const today = todayColumn();
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intl, { weekday: "short" }).format(addDays(gridStart, i)),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-section font-semibold text-ink first-letter:uppercase">{monthLabel}</h2>
        <div className="flex items-center gap-2">
          <Button
            aria-label={t("previousMonth")}
            className="px-2"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </Button>
          <Button onClick={() => setCursor(new Date())}>{t("today")}</Button>
          <Button
            aria-label={t("nextMonth")}
            className="px-2"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-panel border border-line">
        <div className="grid grid-cols-7 bg-night">
          {weekdayNames.map((name) => (
            <div key={name} className="px-2 py-2 text-center text-meta font-medium text-ink-muted">
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date) => {
            const key = toColumnDate(date);
            const leave = byDay.get(key);
            const outside = date.getMonth() !== cursor.getMonth();
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPick(key)}
                title={leave ? t(`type_${leave.type}`) : undefined}
                className={cn(
                  "flex h-16 flex-col items-start gap-1 border-b border-e border-line bg-panel p-2 text-start",
                  "hover:bg-raised",
                  outside && "text-ink-muted opacity-60",
                  key === today && "border-t-2 border-t-time",
                )}
              >
                <span className="text-meta tabular text-ink-muted">{date.getDate()}</span>
                {leave ? (
                  <span
                    className={cn(
                      "w-full truncate rounded-full px-2 py-0.5 text-meta font-medium",
                      tone[leave.type],
                    )}
                  >
                    {t(`type_${leave.type}`)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
