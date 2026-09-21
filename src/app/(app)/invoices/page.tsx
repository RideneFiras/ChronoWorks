import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, todayColumn } from "@/lib/format";
import { formatColumn } from "@/lib/money";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/database.types";
import { invoicePill } from "./status";

const FILTERS: (InvoiceStatus | "all")[] = ["all", "draft", "issued", "sent", "paid"];

const FILTER_LABEL: Record<InvoiceStatus, string> = {
  draft: "statusDraft",
  issued: "statusIssued",
  sent: "statusSent",
  paid: "statusPaid",
  cancelled: "statusCancelled",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations("invoices");
  const { profile } = await requireSession();
  const { status } = await searchParams;
  const active = (FILTERS as string[]).includes(status ?? "") ? status! : "all";

  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, number, client_id, status, issue_date, due_date, total, currency")
    .order("issue_date", { ascending: false });

  if (active !== "all") query = query.eq("status", active as InvoiceStatus);

  const [{ data: invoices }, { data: clients }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name"),
  ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const rows = invoices ?? [];
  const today = todayColumn();

  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          <ButtonLink href="/invoices/new" variant="primary">
            {t("new")}
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/invoices" : `/invoices?status=${f}`}
            aria-current={active === f ? "page" : undefined}
            className={
              active === f
                ? "text-meta font-medium text-ink"
                : "text-meta text-ink-muted hover:text-ink"
            }
          >
            {f === "all" ? t("filterAll") : t(FILTER_LABEL[f as InvoiceStatus])}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={t("empty")}
          action={
            <ButtonLink href="/invoices/new" variant="primary">
              {t("new")}
            </ButtonLink>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>{t("number")}</TH>
            <TH>{t("client")}</TH>
            <TH>{t("issueDate")}</TH>
            <TH>{t("dueDate")}</TH>
            <TH>{t("status")}</TH>
            <TH align="end">{t("total")}</TH>
          </THead>
          <TBody>
            {rows.map((inv) => (
              <TR key={inv.id}>
                <TD>
                  <Link href={`/invoices/${inv.id}`} className="text-ink hover:text-brass">
                    {inv.number ?? t("noNumber")}
                  </Link>
                </TD>
                <TD className="text-ink-muted">{clientName.get(inv.client_id) ?? "—"}</TD>
                <TD className="text-ink-muted">{formatDate(inv.issue_date, profile.locale)}</TD>
                <TD className="text-ink-muted">{formatDate(inv.due_date, profile.locale)}</TD>
                <TD>
                  {(() => {
                    const pill = invoicePill(inv.status, inv.due_date, today);
                    return <StatusPill tone={pill.tone} label={t(pill.key)} />;
                  })()}
                </TD>
                <TD numeric>{formatColumn(inv.total, inv.currency, profile.locale)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
