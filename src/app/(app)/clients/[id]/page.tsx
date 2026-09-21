import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/page";
import { PeriodFilter } from "@/components/ui/period-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDuration, hoursPerDayFrom } from "@/lib/duration";
import { formatDate } from "@/lib/format";
import { periodRange, readPeriod } from "@/lib/period";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const period = readPeriod((await searchParams).period);
  const { from, to } = periodRange(period);
  const t = await getTranslations("clients");
  const tp = await getTranslations("projects");
  const ti = await getTranslations("invoices");
  const ts = await getTranslations("settings");
  const tper = await getTranslations("period");
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

  // A client can have several projects, so the hours are totalled per project
  // and then for the client as a whole.
  const projectIds = (projects ?? []).map((p) => p.id);
  let minutesByProject = new Map<string, number>();
  if (projectIds.length > 0) {
    let entryQuery = supabase
      .from("time_entries")
      .select("project_id, duration_minutes")
      .in("project_id", projectIds);
    if (from && to) entryQuery = entryQuery.gte("entry_date", from).lte("entry_date", to);

    const { data: entries } = await entryQuery;
    minutesByProject = (entries ?? []).reduce((acc, e) => {
      acc.set(e.project_id, (acc.get(e.project_id) ?? 0) + e.duration_minutes);
      return acc;
    }, new Map<string, number>());
  }
  const clientMinutes = [...minutesByProject.values()].reduce((a, b) => a + b, 0);
  const hoursPerDay = hoursPerDayFrom(profile.hours_per_day);

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

      <div className="mb-4">
        <PeriodFilter active={period} basePath={`/clients/${id}`} />
      </div>

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
              <TH align="end">{tper("hours")}</TH>
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
                  <TD numeric className={(minutesByProject.get(p.id) ?? 0) === 0 ? "text-ink-muted" : undefined}>
                    {(minutesByProject.get(p.id) ?? 0) === 0
                      ? "—"
                      : formatDuration(
                          minutesByProject.get(p.id) ?? 0,
                          { hoursPerDay, allowDays: p.rate_type === "daily" },
                          profile.locale,
                        )}
                  </TD>
                  <TD numeric>
                    {formatColumn(p.rate_amount, p.currency, profile.locale)}{" "}
                    <span className="font-normal text-ink-muted">{rateLabel[p.rate_type]}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {(projects ?? []).length > 0 ? (
          <p className="mt-4 text-body text-ink-muted">
            {tper(period)}:{" "}
            <span className="tabular font-medium text-ink">
              {clientMinutes === 0
                ? tper("noneInPeriod")
                : formatDuration(clientMinutes, { hoursPerDay, allowDays: false }, profile.locale)}
            </span>
          </p>
        ) : null}
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
