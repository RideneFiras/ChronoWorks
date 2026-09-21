"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { parseDuration } from "@/lib/duration";
import { todayColumn } from "@/lib/format";
import type { TaskRow } from "@/lib/database.types";
import { addTimeEntry } from "@/app/(app)/time-actions";

/** "Log time" on a task card creates a time entry with task_id set
 *  (PRD section 5, the first link in the table). */
export function LogTimeDialog({
  projectId,
  task,
  hoursPerDay,
  onClose,
}: {
  projectId: string;
  task: TaskRow;
  hoursPerDay: number;
  onClose: () => void;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(todayColumn());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog title={t("logTimeOn", { task: task.title })} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("duration")} htmlFor="log_duration">
            <Input
              id="log_duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="1h30"
            />
          </Field>
          <Field label={t("date")} htmlFor="log_date">
            <Input
              id="log_date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label={t("note")} htmlFor="log_note">
          <Input
            id="log_note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </Field>

        {error ? (
          <p role="alert" className="text-meta text-red">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button size="dialog" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button
            size="dialog"
            variant="primary"
            disabled={pending || duration.trim() === ""}
            onClick={() => {
              const minutes = parseDuration(duration, { hoursPerDay, allowDays: true });
              if (minutes === null) {
                setError(t("estimateHelp"));
                return;
              }
              setError(null);
              start(async () => {
                const result = await addTimeEntry(projectId, date, minutes, note, task.id);
                if (!result.ok) setError(result.reason ?? null);
                else onClose();
              });
            }}
          >
            {pending ? tCommon("saving") : t("logTime")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
