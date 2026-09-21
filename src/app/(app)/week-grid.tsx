"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDuration, parseDuration } from "@/lib/duration";
import { isWeekend } from "@/lib/week";
import type { AppLocale, ProjectStatus, TimeEntryRow } from "@/lib/database.types";
import { DayEditor } from "./day-editor";
import { reactivateProject, setCellDuration } from "./time-actions";

export interface GridRow {
  projectId: string;
  projectName: string;
  clientName: string;
  status: ProjectStatus;
  rateType: "daily" | "hourly" | "fixed";
  /** entry_date -> the entries logged that day */
  cells: Record<string, TimeEntryRow[]>;
}

export function WeekGrid({
  rows,
  days,
  today,
  leaveDays,
  hoursPerDay,
  locale,
}: {
  rows: GridRow[];
  days: string[];
  today: string;
  leaveDays: Record<string, string>;
  hoursPerDay: number;
  locale: AppLocale;
}) {
  const t = useTranslations("week");
  const tp = useTranslations("projects");
  const router = useRouter();

  const [editing, setEditing] = useState<{ row: number; day: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<{ tone: "warn" | "error"; text: string } | null>(null);
  const [dayEditor, setDayEditor] = useState<{ row: GridRow; date: string } | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const statusLabel: Record<ProjectStatus, string> = {
    active: tp("statusActive"),
    paused: tp("statusPaused"),
    done: tp("statusDone"),
  };

  function cellMinutes(row: GridRow, date: string): number {
    return (row.cells[date] ?? []).reduce((sum, e) => sum + e.duration_minutes, 0);
  }

  function openCell(rowIndex: number, dayIndex: number) {
    const row = rows[rowIndex];
    const date = days[dayIndex];
    const entries = row.cells[date] ?? [];

    // More than one entry is not a single value, so edit the day instead.
    if (entries.length > 1) {
      setDayEditor({ row, date });
      return;
    }
    setMessage(null);
    setEditing({ row: rowIndex, day: dayIndex });
    setDraft(entries.length === 1 ? String(entries[0].duration_minutes / 60) : "");
  }

  function commit(rowIndex: number, dayIndex: number, then?: () => void) {
    const row = rows[rowIndex];
    const date = days[dayIndex];
    const text = draft.trim();

    const minutes =
      text === ""
        ? null
        : parseDuration(text, { hoursPerDay, allowDays: row.rateType === "daily" });

    if (text !== "" && minutes === null) {
      setMessage({ tone: "error", text: t("badDuration") });
      return;
    }

    setEditing(null);
    startTransition(async () => {
      const result = await setCellDuration(row.projectId, date, minutes);
      if (!result.ok) {
        if (result.reason === "several") {
          setDayEditor({ row, date });
        } else {
          setMessage({ tone: "error", text: result.reason ?? t("badDuration") });
        }
        return;
      }
      if (minutes !== null && leaveDays[date]) {
        setMessage({ tone: "warn", text: t("leaveWarning") });
      }
      router.refresh();
      then?.();
    });
  }

  function onKeyDown(e: React.KeyboardEvent, rowIndex: number, dayIndex: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(rowIndex, dayIndex);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const next = dayIndex + (e.shiftKey ? -1 : 1);
      commit(rowIndex, dayIndex, () => {
        if (next >= 0 && next < days.length) openCell(rowIndex, next);
      });
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    }
  }

  const dayTotals = days.map((d) => rows.reduce((sum, r) => sum + cellMinutes(r, d), 0));
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const dayName = (date: string) =>
    new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      weekday: "short",
      day: "numeric",
    }).format(new Date(`${date}T00:00:00`));

  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-x rounded-panel border border-line">
        <table className="w-full border-collapse text-body">
          <thead className="bg-night">
            <tr>
              <th scope="col" className="h-11 min-w-[220px] px-3 text-start text-meta font-medium text-ink-muted">
                {t("project")}
              </th>
              {days.map((date) => (
                <th
                  key={date}
                  scope="col"
                  className={cn(
                    "h-11 px-2 text-center text-meta font-medium text-ink-muted",
                    isWeekend(date) ? "w-[56px]" : "w-[84px]",
                    // Today: a 2px teal line across the top of the column, like
                    // the hand of a sundial. Nothing else changes.
                    date === today && "border-t-2 border-t-time",
                  )}
                >
                  {dayName(date)}
                </th>
              ))}
              <th scope="col" className="h-11 w-[84px] px-3 text-end text-meta font-medium text-ink-muted">
                {t("total")}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => {
              const rowTotal = days.reduce((sum, d) => sum + cellMinutes(row, d), 0);
              return (
                <tr key={row.projectId} className="border-t border-line bg-panel">
                  <th scope="row" className="h-11 px-3 text-start font-normal">
                    <Link
                      href={`/projects/${row.projectId}`}
                      className="text-ink hover:text-brass"
                    >
                      {row.clientName} / {row.projectName}
                    </Link>
                    {row.status !== "active" ? (
                      <StatusPill
                        tone={row.status === "paused" ? "paused" : "done"}
                        label={statusLabel[row.status]}
                        className="ms-2"
                      />
                    ) : null}
                  </th>

                  {days.map((date, dayIndex) => {
                    const minutes = cellMinutes(row, date);
                    const entries = row.cells[date] ?? [];
                    const isEditing =
                      editing?.row === rowIndex && editing?.day === dayIndex;
                    const locked = entries.some((e) => e.invoice_id);

                    return (
                      <td
                        key={date}
                        className={cn("h-11 p-0 text-center", leaveDays[date] && "hatched")}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => onKeyDown(e, rowIndex, dayIndex)}
                            onBlur={() => commit(rowIndex, dayIndex)}
                            aria-label={`${row.projectName} ${date}`}
                            className="h-10 w-full bg-night text-center text-body tabular text-ink outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCell(rowIndex, dayIndex)}
                            aria-label={`${row.projectName} ${date}`}
                            title={locked ? t("several", { count: entries.length }) : undefined}
                            className={cn(
                              "h-10 w-full text-center text-body tabular",
                              minutes > 0 ? "text-ink" : "text-ink-muted",
                              "hover:bg-raised",
                            )}
                          >
                            {entries.length > 1
                              ? formatDuration(
                                  minutes,
                                  { hoursPerDay, allowDays: row.rateType === "daily" },
                                  locale,
                                )
                              : minutes > 0
                                ? formatDuration(
                                    minutes,
                                    { hoursPerDay, allowDays: row.rateType === "daily" },
                                    locale,
                                  )
                                : "·"}
                          </button>
                        )}
                      </td>
                    );
                  })}

                  <td className="h-11 px-3 text-end text-body tabular font-medium text-ink">
                    {rowTotal > 0
                      ? formatDuration(
                          rowTotal,
                          { hoursPerDay, allowDays: row.rateType === "daily" },
                          locale,
                        )
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-line bg-night">
              <th scope="row" className="h-11 px-3 text-start text-meta font-medium text-ink-muted">
                {t("dayTotal")}
              </th>
              {dayTotals.map((minutes, i) => (
                <td
                  key={days[i]}
                  className={cn(
                    "h-11 px-2 text-center text-body tabular font-medium",
                    minutes > 0 ? "text-ink" : "text-ink-muted",
                    days[i] === today && "text-time",
                  )}
                >
                  {minutes > 0 ? formatDuration(minutes, { hoursPerDay, allowDays: false }, locale) : ""}
                </td>
              ))}
              <td className="h-11 px-3 text-end text-body tabular font-medium text-ink">
                {weekTotal > 0
                  ? formatDuration(weekTotal, { hoursPerDay, allowDays: false }, locale)
                  : ""}
              </td>
            </tr>

            {Object.keys(leaveDays).length > 0 ? (
              <tr className="border-t border-line bg-night">
                <th scope="row" className="h-11 px-3 text-start text-meta font-medium text-ink-muted">
                  {t("leave")}
                </th>
                {days.map((date) => (
                  <td
                    key={date}
                    className={cn("h-11 px-2 text-center", leaveDays[date] && "hatched")}
                  >
                    <span className="sr-only">{leaveDays[date] ?? ""}</span>
                  </td>
                ))}
                <td />
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>

      <p className="text-meta text-ink-muted">{t("cellHint")}</p>

      {message ? (
        <p
          role="status"
          className={cn("text-meta", message.tone === "warn" ? "text-amber" : "text-red")}
        >
          {message.text}
        </p>
      ) : null}

      {/* Logging on a paused or done project offers to reactivate it. */}
      {rows
        .filter((r) => r.status !== "active" && days.some((d) => cellMinutes(r, d) > 0))
        .map((r) => (
          <div key={r.projectId} className="flex flex-wrap items-center gap-3">
            <p className="text-meta text-amber">
              {t("pausedWarning", { status: statusLabel[r.status].toLowerCase() })}
            </p>
            <Button
              onClick={() =>
                startTransition(async () => {
                  await reactivateProject(r.projectId);
                  router.refresh();
                })
              }
            >
              {t("reactivate")}
            </Button>
          </div>
        ))}

      {dayEditor ? (
        <DayEditor
          projectId={dayEditor.row.projectId}
          projectName={dayEditor.row.projectName}
          date={dayEditor.date}
          entries={dayEditor.row.cells[dayEditor.date] ?? []}
          hoursPerDay={hoursPerDay}
          allowDays={dayEditor.row.rateType === "daily"}
          locale={locale}
          onClose={() => {
            setDayEditor(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
