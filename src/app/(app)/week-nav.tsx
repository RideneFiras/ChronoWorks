"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shiftWeek, thisWeekAnchor } from "@/lib/week";
import { useLocale } from "next-intl";

/** Previous, next, this week. Keyboard: [ and ] (DESIGN.md section 6). */
export function WeekNav({ anchor, days }: { anchor: string; days: string[] }) {
  const t = useTranslations("week");
  const router = useRouter();
  const locale = useLocale();

  const go = (weeks: number) => router.push(`/?w=${shiftWeek(anchor, weeks)}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.key === "[") go(-1);
      if (e.key === "]") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  // "21 – 27 sept. 2026" rather than two ISO dates.
  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const range = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatRange(
    new Date(`${days[0]}T00:00:00`),
    new Date(`${days[days.length - 1]}T00:00:00`),
  );

  return (
    <div className="flex items-center gap-2">
      <span className="me-2 text-meta tabular text-ink-muted">{range}</span>
      <Button onClick={() => go(-1)} aria-label={t("previous")} className="px-2">
        <ChevronLeft size={16} strokeWidth={1.5} />
      </Button>
      <Button onClick={() => router.push(`/?w=${thisWeekAnchor()}`)}>{t("thisWeek")}</Button>
      <Button onClick={() => go(1)} aria-label={t("next")} className="px-2">
        <ChevronRight size={16} strokeWidth={1.5} />
      </Button>
    </div>
  );
}
