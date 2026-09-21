import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader, Section } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, todayColumn } from "@/lib/format";
import { formatColumn, formatMoney, fromColumn } from "@/lib/money";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Currency, InvoiceUnit, PartySnapshot } from "@/lib/database.types";
import { DraftEditor } from "./draft-editor";
import { IssuedActions } from "./issued-view";
import { invoicePill } from "../status";

const unitKey: Record<InvoiceUnit, string> = {
  day: "unitDay",
  hour: "unitHour",
  unit: "unitUnit",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("invoices");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const [{ data: invoice }, { data: lines }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("position"),
  ]);

  if (!invoice) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", invoice.client_id)
    .maybeSingle();

  const rows = lines ?? [];
  const currency = invoice.currency as Currency;
  const isDraft = invoice.status === "draft";
  const pill = invoicePill(invoice.status, invoice.due_date, todayColumn());

  return (
    <>
      <PageHeader
        title={invoice.number ?? t("noNumber")}
        action={
          isDraft ? undefined : (
            <IssuedActions
              invoiceId={invoice.id}
              status={invoice.status as "issued" | "sent" | "paid" | "cancelled"}
            />
          )
        }
      >
        <StatusPill tone={pill.tone} label={t(pill.key)} />
      </PageHeader>

      <dl className="mb-8 grid gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-meta text-ink-muted">{t("client")}</dt>
          <dd className="mt-1 text-body">
            <Link href={`/clients/${invoice.client_id}`} className="text-ink hover:text-brass">
              {client?.name ?? "—"}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">{t("issueDate")}</dt>
          <dd className="mt-1 text-body text-ink">
            {formatDate(invoice.issue_date, profile.locale)}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">{t("dueDate")}</dt>
          <dd className="mt-1 text-body text-ink">
            {formatDate(invoice.due_date, profile.locale)}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">{t("total")}</dt>
          <dd className="mt-1 text-body tabular font-medium text-ink">
            {formatColumn(invoice.total, currency, profile.locale)}
          </dd>
        </div>
      </dl>

      {isDraft ? (
        <DraftEditor invoice={invoice} lines={rows} locale={profile.locale} />
      ) : (
        <>
          <p className="mb-6 text-meta text-ink-muted">{t("lockedNotice")}</p>

          <Section title={t("lines")} className="mb-8">
            <Table>
              <THead>
                <TH>{t("description")}</TH>
                <TH align="end">{t("quantity")}</TH>
                <TH>{t("unit")}</TH>
                <TH align="end">{t("unitPrice")}</TH>
                <TH align="end">{t("taxRate")}</TH>
                <TH align="end">{t("lineTotal")}</TH>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>{row.description}</TD>
                    <TD numeric>{row.quantity}</TD>
                    <TD className="text-ink-muted">{t(unitKey[row.unit])}</TD>
                    <TD numeric>{formatColumn(row.unit_price, currency, profile.locale)}</TD>
                    <TD numeric>{row.tax_rate}</TD>
                    <TD numeric>{formatColumn(row.line_total, currency, profile.locale)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Section>

          <div className="grid gap-8 lg:grid-cols-2">
            <Section title={t("seller")}>
              <Party snapshot={invoice.seller_snapshot} nameKey="legal_name" />
            </Section>

            <Section title={t("total")}>
              <dl className="flex flex-col gap-2 text-body">
                <Line
                  label={t("subtotal")}
                  value={formatColumn(invoice.subtotal, currency, profile.locale)}
                />
                <Line
                  label={t("taxTotal")}
                  value={formatColumn(invoice.tax_total, currency, profile.locale)}
                />
                {fromColumn(invoice.stamp_duty) > 0n ? (
                  <Line
                    label={t("stampDuty")}
                    value={formatColumn(invoice.stamp_duty, currency, profile.locale)}
                  />
                ) : null}
                {fromColumn(invoice.withholding) > 0n ? (
                  <Line
                    label={t("withholding")}
                    value={`-${formatColumn(invoice.withholding, currency, profile.locale)}`}
                  />
                ) : null}
                <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-section font-semibold text-ink">
                    {fromColumn(invoice.withholding) > 0n ? t("netToPay") : t("total")}
                  </dt>
                  <dd className="text-section font-semibold tabular text-ink">
                    {formatMoney(fromColumn(invoice.total), currency, profile.locale)}
                  </dd>
                </div>
              </dl>
            </Section>

            <Section title={t("buyer")}>
              <Party snapshot={invoice.buyer_snapshot} nameKey="name" />
            </Section>
          </div>
        </>
      )}
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular text-ink">{value}</dd>
    </div>
  );
}

/** Reads the snapshot frozen at issue time, never the live client row. */
function Party({
  snapshot,
  nameKey,
}: {
  snapshot: PartySnapshot | null;
  nameKey: "legal_name" | "name";
}) {
  if (!snapshot) return <p className="text-body text-ink-muted">—</p>;

  const get = (key: keyof PartySnapshot) => {
    const value = snapshot[key];
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };

  return (
    <div className="flex flex-col gap-1 text-body text-ink">
      <span className="font-medium">{get(nameKey) ?? "—"}</span>
      {get("address")
        ?.split("\n")
        .map((part, i) => (
          <span key={i} className="text-ink-muted">
            {part}
          </span>
        ))}
      {get("tax_id") ? <span className="text-ink-muted">{get("tax_id")}</span> : null}
      {get("vat_number") ? <span className="text-ink-muted">{get("vat_number")}</span> : null}
      {get("iban") ? <span className="text-ink-muted">{get("iban")}</span> : null}
    </div>
  );
}
