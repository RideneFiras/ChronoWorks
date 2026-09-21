"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import { createInvoiceDraft } from "../actions";

/** Pick a client and a period; the draft is built from that client's unbilled
 *  time in it. PRD section 5: "Invoice builder lists unbilled entries for a
 *  client and period." */
export function InvoiceBuilder({
  clients,
  defaultFrom,
  defaultTo,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  defaultFrom: string;
  defaultTo: string;
  defaultClientId?: string;
}) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [fromTime, setFromTime] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Section title={t("builder")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("chooseClient")} htmlFor="client_id">
          <Select
            id="client_id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div />

        <Field label={t("periodFrom")} htmlFor="from">
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>

        <Field label={t("periodTo")} htmlFor="to">
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-body text-ink">
        <input
          type="checkbox"
          checked={fromTime}
          onChange={(e) => setFromTime(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-brass)]"
        />
        {t("builder")}
      </label>

      {error ? (
        <p role="alert" className="mt-4 text-meta text-red">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <Button
          variant="primary"
          disabled={pending || clientId === ""}
          onClick={() =>
            start(async () => {
              const result = await createInvoiceDraft(clientId, from, to, fromTime);
              if (result && !result.ok) setError(result.reason ?? null);
            })
          }
        >
          {pending ? tCommon("saving") : t("create")}
        </Button>
      </div>
    </Section>
  );
}
