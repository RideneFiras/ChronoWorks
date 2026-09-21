"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney, fromColumn, percentOf } from "@/lib/money";
import type { AppLocale, Currency, InvoiceLineRow, InvoiceRow } from "@/lib/database.types";
import {
  addInvoiceLine,
  deleteDraft,
  deleteInvoiceLine,
  issueInvoice,
  updateInvoiceDraft,
  updateInvoiceLine,
} from "../actions";

export function DraftEditor({
  invoice,
  lines,
  locale,
}: {
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
  locale: AppLocale;
}) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();

  const currency = invoice.currency as Currency;
  const money = (value: bigint) => formatMoney(value, currency, locale);

  // Totals are shown live here, but issue_invoice() recomputes them in the
  // database. These are a preview, never the stored value.
  let subtotal = 0n;
  const vatByRate = new Map<string, bigint>();
  for (const row of lines) {
    const amount = fromColumn(row.line_total);
    subtotal += amount;
    vatByRate.set(
      row.tax_rate,
      (vatByRate.get(row.tax_rate) ?? 0n) + percentOf(amount, fromColumn(row.tax_rate) / 10n),
    );
  }
  const taxTotal = [...vatByRate.values()].reduce((a, b) => a + b, 0n);
  const stamp = fromColumn(invoice.stamp_duty);
  const withholding = fromColumn(invoice.withholding);
  const total = subtotal + taxTotal + stamp - withholding;

  return (
    <>
      <Section title={t("lines")} className="mb-8">
        <Table>
          <THead>
            <TH>{t("description")}</TH>
            <TH align="end">{t("quantity")}</TH>
            <TH>{t("unit")}</TH>
            <TH align="end">{t("unitPrice")}</TH>
            <TH align="end">{t("taxRate")}</TH>
            <TH align="end">{t("lineTotal")}</TH>
            <TH />
          </THead>
          <TBody>
            {lines.map((row) => (
              <LineRow
                key={row.id}
                invoiceId={invoice.id}
                row={row}
                currency={currency}
                locale={locale}
                onError={setError}
              />
            ))}
          </TBody>
        </Table>

        <div className="mt-4">
          <Button
            onClick={() =>
              start(async () => {
                await addInvoiceLine(invoice.id);
                router.refresh();
              })
            }
          >
            {t("addLine")}
          </Button>
        </div>
      </Section>

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        <Section title={t("notes")}>
          <form
            action={(form: FormData) =>
              start(async () => {
                const result = await updateInvoiceDraft(invoice.id, {
                  stamp_duty: String(form.get("stamp_duty") ?? "0"),
                  withholding: String(form.get("withholding") ?? "0"),
                  notes: String(form.get("notes") ?? ""),
                  due_date: String(form.get("due_date") ?? invoice.due_date),
                });
                if (!result.ok) setError(result.reason ?? null);
                else toast(t("saved"));
                router.refresh();
              })
            }
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("dueDate")} htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" defaultValue={invoice.due_date} />
              </Field>
              <Field label={t("stampDuty")} htmlFor="stamp_duty">
                <Input id="stamp_duty" name="stamp_duty" inputMode="decimal" defaultValue={invoice.stamp_duty} />
              </Field>
              <Field label={t("withholding")} htmlFor="withholding">
                <Input id="withholding" name="withholding" inputMode="decimal" defaultValue={invoice.withholding} />
              </Field>
            </div>

            <Field label={t("notes")} htmlFor="notes">
              <Textarea id="notes" name="notes" rows={3} defaultValue={invoice.notes ?? ""} />
            </Field>

            <div>
              <Button type="submit" disabled={pending}>
                {tCommon("save")}
              </Button>
            </div>
          </form>
        </Section>

        <Section title={t("total")}>
          <dl className="flex flex-col gap-2 text-body">
            <Row label={t("subtotal")} value={money(subtotal)} />
            {[...vatByRate.entries()]
              .filter(([, amount]) => amount > 0n)
              .map(([rate, amount]) => (
                <Row key={rate} label={`${t("taxTotal")} ${rate}%`} value={money(amount)} />
              ))}
            {stamp > 0n ? <Row label={t("stampDuty")} value={money(stamp)} /> : null}
            {withholding > 0n ? (
              <Row label={t("withholding")} value={`-${money(withholding)}`} />
            ) : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
              <dt className="text-section font-semibold text-ink">
                {withholding > 0n ? t("netToPay") : t("total")}
              </dt>
              <dd className="text-section font-semibold tabular text-ink">{money(total)}</dd>
            </div>
          </dl>
        </Section>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-meta text-red">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Button
          variant="primary"
          disabled={pending || lines.length === 0}
          onClick={() => setConfirming(true)}
        >
          {t("issue")}
        </Button>
        {lines.length === 0 ? (
          <p className="text-meta text-ink-muted">{t("cannotIssueEmpty")}</p>
        ) : null}
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => start(async () => void (await deleteDraft(invoice.id)))}
        >
          {t("deleteDraft")}
        </Button>
      </div>

      {confirming ? (
        <Dialog title={t("issueConfirm")} onClose={() => setConfirming(false)}>
          <p className="max-w-[60ch] text-body text-ink-muted">{t("issueBody")}</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button size="dialog" onClick={() => setConfirming(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              size="dialog"
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await issueInvoice(invoice.id);
                  setConfirming(false);
                  if (!result.ok) setError(result.reason ?? null);
                  else toast(t("issued"));
                  router.refresh();
                })
              }
            >
              {t("issue")}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular text-ink">{value}</dd>
    </div>
  );
}

function LineRow({
  invoiceId,
  row,
  currency,
  locale,
  onError,
}: {
  invoiceId: string;
  row: InvoiceLineRow;
  currency: Currency;
  locale: AppLocale;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("invoices");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState({
    description: row.description,
    quantity: row.quantity,
    unit: row.unit as string,
    unit_price: row.unit_price,
    tax_rate: row.tax_rate,
  });

  function save(next = values) {
    start(async () => {
      const result = await updateInvoiceLine(invoiceId, row.id, next);
      if (!result.ok) onError(result.reason ?? null);
      else onError(null);
      router.refresh();
    });
  }

  const cell = "h-9 w-full rounded-control border border-line bg-night px-2 text-body text-ink";

  return (
    <TR>
      <TD>
        <input
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          onBlur={() => save()}
          aria-label={t("description")}
          className={cell}
        />
      </TD>
      <TD align="end">
        <input
          value={values.quantity}
          onChange={(e) => setValues({ ...values, quantity: e.target.value })}
          onBlur={() => save()}
          aria-label={t("quantity")}
          inputMode="decimal"
          className={`${cell} text-end tabular`}
        />
      </TD>
      <TD>
        <Select
          value={values.unit}
          onChange={(e) => {
            const next = { ...values, unit: e.target.value };
            setValues(next);
            save(next);
          }}
          aria-label={t("unit")}
          className="h-9"
        >
          <option value="day">{t("unitDay")}</option>
          <option value="hour">{t("unitHour")}</option>
          <option value="unit">{t("unitUnit")}</option>
        </Select>
      </TD>
      <TD align="end">
        <input
          value={values.unit_price}
          onChange={(e) => setValues({ ...values, unit_price: e.target.value })}
          onBlur={() => save()}
          aria-label={t("unitPrice")}
          inputMode="decimal"
          className={`${cell} text-end tabular`}
        />
      </TD>
      <TD align="end">
        <input
          value={values.tax_rate}
          onChange={(e) => setValues({ ...values, tax_rate: e.target.value })}
          onBlur={() => save()}
          aria-label={t("taxRate")}
          inputMode="decimal"
          className={`${cell} text-end tabular`}
        />
      </TD>
      <TD numeric>{formatMoney(fromColumn(row.line_total), currency, locale)}</TD>
      <TD align="end">
        <button
          type="button"
          disabled={pending}
          aria-label={t("removeLine")}
          onClick={() =>
            start(async () => {
              const result = await deleteInvoiceLine(invoiceId, row.id);
              if (!result.ok) onError(result.reason ?? null);
              router.refresh();
            })
          }
          className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-red-tint hover:text-red"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </TD>
    </TR>
  );
}
