"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { ProjectStatus } from "@/lib/database.types";
import { changeProjectStatus } from "./actions";

export function ChangeStatus({ id, status }: { id: string; status: ProjectStatus }) {
  const t = useTranslations("projects");
  const [next, setNext] = useState<ProjectStatus>(status);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const changed = next !== status;

  return (
    <div className="grid items-end gap-4 sm:grid-cols-[200px_1fr_auto]">
      <Field label={t("status")} htmlFor="next_status">
        <Select
          id="next_status"
          value={next}
          onChange={(e) => setNext(e.target.value as ProjectStatus)}
        >
          <option value="active">{t("statusActive")}</option>
          <option value="paused">{t("statusPaused")}</option>
          <option value="done">{t("statusDone")}</option>
        </Select>
      </Field>

      <Field label={t("statusNote")} htmlFor="status_note" help={t("statusNoteHelp")}>
        <Input
          id="status_note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
        />
      </Field>

      <Button
        variant="primary"
        disabled={!changed || pending}
        onClick={() =>
          start(async () => {
            await changeProjectStatus(id, next, note);
            setNote("");
          })
        }
      >
        {t("changeStatus")}
      </Button>
    </div>
  );
}
