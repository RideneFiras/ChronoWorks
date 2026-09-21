"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { formatDuration, parseDuration } from "@/lib/duration";
import { formatDateLong } from "@/lib/format";
import type { AppLocale, TimeEntryRow } from "@/lib/database.types";
import { addTimeEntry, deleteTimeEntry, updateTimeEntry } from "./time-actions";

/**
 * A cell that holds more than one entry is not a single value, so it opens
 * here instead of editing inline. DESIGN.md section 5: --raised, 1px --line,
 * max 480px, actions right-aligned, Escape closes, focus trapped.
 */
export function DayEditor({
  projectId,
  projectName,
  date,
  entries,
  hoursPerDay,
  allowDays,
  locale,
  onClose,
}: {
  projectId: string;
  projectName: string;
  date: string;
  entries: TimeEntryRow[];
  hoursPerDay: number;
  allowDays: boolean;
  locale: AppLocale;
  onClose: () => void;
}) {
  const t = useTranslations("week");
  const tCommon = useTranslations("common");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newDuration, setNewDuration] = useState("");
  const [newNote, setNewNote] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function parse(text: string): number | null {
    return parseDuration(text, { hoursPerDay, allowDays });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("editEntries", { date: formatDateLong(date, locale) })}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="w-full max-w-[480px] rounded-panel border border-line bg-raised p-6"
      >
        <h2 className="text-section font-semibold text-ink">
          {t("editEntries", { date: formatDateLong(date, locale) })}
        </h2>
        <p className="mt-1 text-meta text-ink-muted">{projectName}</p>

        <ul className="mt-4 flex flex-col">
          {entries.length === 0 ? (
            <li className="py-3 text-body text-ink-muted">{t("noEntries")}</li>
          ) : (
            entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                hoursPerDay={hoursPerDay}
                allowDays={allowDays}
                locale={locale}
                onError={setError}
              />
            ))
          )}
        </ul>

        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[110px_1fr]">
          <Field label={t("duration")} htmlFor="new_duration">
            <Input
              id="new_duration"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="1h30"
            />
          </Field>
          <Field label={t("note")} htmlFor="new_note">
            <Input
              id="new_note"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              maxLength={200}
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-meta text-red">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button size="dialog" onClick={onClose}>
            {t("close")}
          </Button>
          <Button
            size="dialog"
            variant="primary"
            disabled={pending || newDuration.trim() === ""}
            onClick={() => {
              const minutes = parse(newDuration);
              if (minutes === null) {
                setError(t("badDuration"));
                return;
              }
              setError(null);
              start(async () => {
                const r = await addTimeEntry(projectId, date, minutes, newNote);
                if (!r.ok) setError(r.reason ?? "");
                else {
                  setNewDuration("");
                  setNewNote("");
                }
              });
            }}
          >
            {pending ? tCommon("saving") : t("addEntry")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  hoursPerDay,
  allowDays,
  locale,
  onError,
}: {
  entry: TimeEntryRow;
  hoursPerDay: number;
  allowDays: boolean;
  locale: AppLocale;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("week");
  const [pending, start] = useTransition();
  const [value, setValue] = useState(
    formatDuration(entry.duration_minutes, { hoursPerDay, allowDays: false }, locale),
  );
  const [note, setNote] = useState(entry.description ?? "");

  // An entry attached to an issued invoice is frozen by the database.
  const locked = Boolean(entry.invoice_id);

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <input
        value={value}
        disabled={locked || pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const minutes = parseDuration(value, { hoursPerDay, allowDays });
          if (minutes === null) {
            onError(t("badDuration"));
            return;
          }
          onError(null);
          start(async () => {
            const r = await updateTimeEntry(entry.id, minutes, note);
            if (!r.ok) onError(r.reason ?? "");
          });
        }}
        aria-label={t("duration")}
        className="h-9 w-[92px] rounded-control border border-line bg-night px-2 text-body tabular text-ink disabled:opacity-50"
      />
      <input
        value={note}
        disabled={locked || pending}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          const minutes = parseDuration(value, { hoursPerDay, allowDays });
          if (minutes === null) return;
          start(async () => {
            const r = await updateTimeEntry(entry.id, minutes, note);
            if (!r.ok) onError(r.reason ?? "");
          });
        }}
        aria-label={t("note")}
        maxLength={200}
        className="h-9 min-w-0 flex-1 rounded-control border border-line bg-night px-2 text-body text-ink disabled:opacity-50"
      />
      <button
        type="button"
        disabled={locked || pending}
        aria-label={`${t("duration")} ${entry.duration_minutes}`}
        onClick={() =>
          start(async () => {
            const r = await deleteTimeEntry(entry.id);
            if (!r.ok) onError(r.reason ?? "");
          })
        }
        className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-red-tint hover:text-red disabled:opacity-50"
      >
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </li>
  );
}
