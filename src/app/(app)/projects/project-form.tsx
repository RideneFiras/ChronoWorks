"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import type { ClientRow, ProjectRow } from "@/lib/database.types";
import { createProject, updateProject } from "./actions";
import { emptyFormState, type FormState } from "@/lib/form-state";

export function ProjectForm({
  project,
  clients,
  defaultClientId,
}: {
  project?: ProjectRow;
  clients: Pick<ClientRow, "id" | "name" | "currency">[];
  defaultClientId?: string;
}) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const editing = Boolean(project);

  const [state, action, pending] = useActionState<FormState, FormData>(
    editing ? updateProject : createProject,
    emptyFormState,
  );

  // A new project starts in its client's currency; the user can still change it.
  const [clientId, setClientId] = useState(project?.client_id ?? defaultClientId ?? "");
  const [currency, setCurrency] = useState(
    project?.currency ?? clients.find((c) => c.id === (defaultClientId ?? ""))?.currency ?? "EUR",
  );

  function onClientChange(id: string) {
    setClientId(id);
    if (!editing) {
      const next = clients.find((c) => c.id === id)?.currency;
      if (next) setCurrency(next);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-8">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}

      <Section title={t("title")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} htmlFor="name" error={state.errors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={project?.name ?? ""}
              required
              maxLength={200}
              autoFocus={!editing}
              aria-invalid={Boolean(state.errors.name)}
            />
          </Field>

          <Field label={t("client")} htmlFor="client_id" error={state.errors.client_id}>
            <Select
              id="client_id"
              name="client_id"
              value={clientId}
              onChange={(e) => onClientChange(e.target.value)}
              required
              aria-invalid={Boolean(state.errors.client_id)}
            >
              <option value="" disabled>
                {t("chooseClient")}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("description")} htmlFor="description" className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={project?.description ?? ""}
            />
          </Field>
        </div>
      </Section>

      <Section title={t("rateType")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("rateType")} htmlFor="rate_type">
            <Select id="rate_type" name="rate_type" defaultValue={project?.rate_type ?? "daily"}>
              <option value="daily">{t("rateDaily")}</option>
              <option value="hourly">{t("rateHourly")}</option>
              <option value="fixed">{t("rateFixed")}</option>
            </Select>
          </Field>

          <Field label={t("rateAmount")} htmlFor="rate_amount" error={state.errors.rate_amount}>
            <Input
              id="rate_amount"
              name="rate_amount"
              inputMode="decimal"
              defaultValue={project?.rate_amount ?? "0"}
              aria-invalid={Boolean(state.errors.rate_amount)}
            />
          </Field>

          <Field label={t("currency")} htmlFor="currency">
            <Select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
            >
              <option value="TND">TND</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </Select>
          </Field>

          <Field label={t("startDate")} htmlFor="start_date">
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={project?.start_date ?? ""}
            />
          </Field>

          <Field label={t("endDate")} htmlFor="end_date" error={state.errors.end_date}>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={project?.end_date ?? ""}
              aria-invalid={Boolean(state.errors.end_date)}
            />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? tCommon("saving") : editing ? tCommon("save") : t("create")}
        </Button>
        <Link
          href={project ? `/projects/${project.id}` : "/projects"}
          className="text-body text-ink-muted hover:text-ink"
        >
          {tCommon("cancel")}
        </Link>
        {state.message ? (
          <p role="alert" className="text-meta text-red">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
