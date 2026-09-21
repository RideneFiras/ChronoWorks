"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import type { ClientRow } from "@/lib/database.types";
import {
  createClientRecord,
  emptyClientState,
  updateClientRecord,
  type ClientFormState,
} from "./actions";

export function ClientForm({
  client,
  defaultCurrency,
}: {
  client?: ClientRow;
  defaultCurrency: string;
}) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const editing = Boolean(client);

  const [state, action, pending] = useActionState<ClientFormState, FormData>(
    editing ? updateClientRecord : createClientRecord,
    emptyClientState,
  );

  return (
    <form action={action} className="flex flex-col gap-8">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      <Section title={t("title")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} htmlFor="name" error={state.errors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={client?.name ?? ""}
              required
              maxLength={200}
              autoFocus={!editing}
              aria-invalid={Boolean(state.errors.name)}
            />
          </Field>

          <Field label={t("email")} htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
          </Field>

          <Field label={t("address")} htmlFor="address" className="sm:col-span-2">
            <Textarea id="address" name="address" rows={3} defaultValue={client?.address ?? ""} />
          </Field>

          <Field label={t("country")} htmlFor="country">
            <Input id="country" name="country" defaultValue={client?.country ?? ""} />
          </Field>

          <Field label={t("currency")} htmlFor="currency" help={t("currencyHelp")}>
            <Select
              id="currency"
              name="currency"
              defaultValue={client?.currency ?? defaultCurrency}
            >
              <option value="TND">TND</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </Select>
          </Field>

          <Field
            label={t("invoiceLanguage")}
            htmlFor="invoice_language"
            help={t("invoiceLanguageHelp")}
          >
            <Select
              id="invoice_language"
              name="invoice_language"
              defaultValue={client?.invoice_language ?? "fr"}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <Field label={t("taxId")} htmlFor="tax_id">
            <Input id="tax_id" name="tax_id" defaultValue={client?.tax_id ?? ""} />
          </Field>

          <Field label={t("vatNumber")} htmlFor="vat_number">
            <Input id="vat_number" name="vat_number" defaultValue={client?.vat_number ?? ""} />
          </Field>

          <Field label={t("notes")} htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? tCommon("saving") : editing ? tCommon("save") : t("create")}
        </Button>
        <Link
          href={client ? `/clients/${client.id}` : "/clients"}
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
