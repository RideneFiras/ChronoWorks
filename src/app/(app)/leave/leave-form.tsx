"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { LeaveRow } from "@/lib/database.types";
import { saveLeave } from "./actions";
import { emptyFormState, type FormState } from "@/lib/form-state";

export function LeaveForm({
  leave,
  defaultDate,
  onDone,
}: {
  leave?: LeaveRow | null;
  defaultDate?: string;
  onDone: () => void;
}) {
  const t = useTranslations("leave");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveLeave,
    emptyFormState,
  );

  useEffect(() => {
    if (state.status === "saved") onDone();
  }, [state.status, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {leave ? <input type="hidden" name="id" value={leave.id} /> : null}

      <Field label={t("type")} htmlFor="type">
        <Select id="type" name="type" defaultValue={leave?.type ?? "vacation"}>
          <option value="vacation">{t("type_vacation")}</option>
          <option value="sick">{t("type_sick")}</option>
          <option value="public_holiday">{t("type_public_holiday")}</option>
          <option value="other">{t("type_other")}</option>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("startDate")} htmlFor="start_date" error={state.errors.start_date}>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={leave?.start_date ?? defaultDate ?? ""}
          />
        </Field>
        <Field label={t("endDate")} htmlFor="end_date" error={state.errors.end_date}>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            required
            defaultValue={leave?.end_date ?? defaultDate ?? ""}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-body text-ink">
          <input
            type="checkbox"
            name="start_half"
            defaultChecked={leave?.start_half ?? false}
            className="h-4 w-4 accent-[var(--color-brass)]"
          />
          {t("startHalf")}
        </label>
        <label className="flex items-center gap-2 text-body text-ink">
          <input
            type="checkbox"
            name="end_half"
            defaultChecked={leave?.end_half ?? false}
            className="h-4 w-4 accent-[var(--color-brass)]"
          />
          {t("endHalf")}
        </label>
      </div>

      <Field label={t("note")} htmlFor="note">
        <Input id="note" name="note" maxLength={200} defaultValue={leave?.note ?? ""} />
      </Field>

      {state.message ? (
        <p role="alert" className="text-meta text-red">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <Button size="dialog" onClick={onDone}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" size="dialog" variant="primary" disabled={pending}>
          {pending ? tCommon("saving") : leave ? tCommon("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
