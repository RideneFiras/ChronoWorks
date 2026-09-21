import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatColumn } from "@/lib/money";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus, ProjectStatus } from "@/lib/database.types";
import { ArchiveToggle } from "../archive-toggle";

const statusTone = {
  active: "active",
  paused: "paused",
  done: "done",
} as const;

const invoiceTone = {
  draft: "draft",
  issued: "issued",
  sent: "issued",
  paid: "paid",
  cancelled: "cancelled",
} as const;

const invoiceStatusKey: Record<InvoiceStatus, string> = {
  draft: "statusDraft",
  issued: "statusIssued",
  sent: "statusSent",
  paid: "statusPaid",
  cancelled: "statusCancelled",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("clients");
  const tp = await getTranslations("projects");
  const ti = await getTranslations("invoices");
  const ts = await getTranslations("settings");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const [{ data: client }, { data: projects }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("projects")
      .select("id, name, status, rate_type, rate_amount, currency, start_date")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, number, status, issue_date, total, currency")
      .eq("client_id", id)
      .order("issue_date", { ascending: false }),
  ]);

  if (!client) notFound();

  const statusLabel: Record<ProjectStatus, string> = {
    active: tp("statusActive"),
    paused: tp("statusPaused"),
    done: tp("statusDone"),
  };

  const rateLabel: Record<string, string> = {
    daily: tp("perDay"),
    hourly: tp("perHour"),
    fixed: tp("fixed"),
  };

  return (
    <>
      <PageHeader
        title={client.name}
        action={<ButtonLink href={`/clients/${id}/edit`}>{t("edit")}</ButtonLink>}
      >
        {client.archived_at ? <StatusPill tone="done" label={t("archived")} /> : null}
      </PageHeader>

      <dl className="mb-8 grid gap-4 sm:grid-cols-3">
        <Detail label={t("email")} value={client.email} />
        <Detail label={t("country")} value={client.country} />
        <Detail label={t("currency")} value={client.currency} />
        <Detail label={t("taxId")} value={client.tax_id} />
        <Detail label={t("vatNumber")} value={client.vat_number} />
        <Detail
          label={t("invoiceLanguage")}
          value={client.invoice_language === "fr" ? ts("languageFr") : ts("languageEn")}
        />
        {client.address ? (
          <div className="sm:col-span-3">
            <dt className="text-meta text-ink-muted">{t("address")}</dt>
            <dd className="mt-1 max-w-[68ch] whitespace-pre-line text-body text-ink">
              {client.address}
            </dd>
          </div>
        ) : null}
        {client.notes ? (
          <div className="sm:col-span-3">
            <dt className="text-meta text-ink-muted">{t("notes")}</dt>
            <dd className="mt-1 max-w-[68ch] whitespace-pre-line text-body text-ink">
              {client.notes}
            </dd>
          </div>
        ) : null}
      </dl>

      <Section title={t("projects")} className="mb-8">
        {(projects ?? []).length === 0 ? (
          <EmptyState
            message={tp("emptyForClient")}
            action={
              <ButtonLink href={`/projects/new?client=${id}`} variant="primary">
                {tp("new")}
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>{tp("name")}</TH>
              <TH>{tp("status")}</TH>
              <TH>{tp("startDate")}</TH>
              <TH align="end">{tp("rateType")}</TH>
            </THead>
            <TBody>
              {(projects ?? []).map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/projects/${p.id}`} className="text-ink hover:text-brass">
                      {p.name}
                    </Link>
                  </TD>
                  <TD>
                    <StatusPill tone={statusTone[p.status]} label={statusLabel[p.status]} />
                  </TD>
                  <TD className="text-ink-muted">{formatDate(p.start_date, profile.locale)}</TD>
                  <TD numeric>
                    {formatColumn(p.rate_amount, p.currency, profile.locale)}{" "}
                    <span className="font-normal text-ink-muted">{rateLabel[p.rate_type]}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      <Section title={t("invoices")} className="mb-8">
        {(invoices ?? []).length === 0 ? (
          <p className="text-body text-ink-muted">{t("noInvoices")}</p>
        ) : (
          <Table>
            <THead>
              <TH>{ti("number")}</TH>
              <TH>{ti("issueDate")}</TH>
              <TH>{ti("status")}</TH>
              <TH align="end">{ti("total")}</TH>
            </THead>
            <TBody>
              {(invoices ?? []).map((inv) => (
                <TR key={inv.id}>
                  <TD>
                    <Link href={`/invoices/${inv.id}`} className="text-ink hover:text-brass">
                      {inv.number ?? ti("noNumber")}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{formatDate(inv.issue_date, profile.locale)}</TD>
                  <TD>
                    <StatusPill
                      tone={invoiceTone[inv.status]}
                      label={ti(invoiceStatusKey[inv.status])}
                    />
                  </TD>
                  <TD numeric>{formatColumn(inv.total, inv.currency, profile.locale)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      <Section title={t("archive")} description={t("archiveHelp")}>
        <ArchiveToggle id={client.id} archived={Boolean(client.archived_at)} />
      </Section>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-1 text-body text-ink">{value || "—"}</dd>
    </div>
  );
}
