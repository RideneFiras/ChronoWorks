import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatColumn } from "@/lib/money";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus, RateType } from "@/lib/database.types";

const tone = { active: "active", paused: "paused", done: "done" } as const;

export default async function ProjectsPage() {
  const t = await getTranslations("projects");
  const tc = await getTranslations("clients");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client_id, status, rate_type, rate_amount, currency, start_date")
      .order("status")
      .order("name"),
    supabase.from("clients").select("id, name"),
  ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const rows = projects ?? [];
  const hasClients = (clients ?? []).length > 0;

  const statusLabel: Record<ProjectStatus, string> = {
    active: t("statusActive"),
    paused: t("statusPaused"),
    done: t("statusDone"),
  };
  const rateLabel: Record<RateType, string> = {
    daily: t("perDay"),
    hourly: t("perHour"),
    fixed: t("fixed"),
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          hasClients ? (
            <ButtonLink href="/projects/new" variant="primary">
              {t("new")}
            </ButtonLink>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          message={hasClients ? t("empty") : tc("empty")}
          action={
            <ButtonLink href={hasClients ? "/projects/new" : "/clients/new"} variant="primary">
              {hasClients ? t("new") : tc("new")}
            </ButtonLink>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>{t("name")}</TH>
            <TH>{t("client")}</TH>
            <TH>{t("status")}</TH>
            <TH>{t("startDate")}</TH>
            <TH align="end">{t("rateType")}</TH>
          </THead>
          <TBody>
            {rows.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link href={`/projects/${p.id}`} className="text-ink hover:text-brass">
                    {p.name}
                  </Link>
                </TD>
                <TD className="text-ink-muted">
                  <Link href={`/clients/${p.client_id}`} className="hover:text-brass">
                    {clientName.get(p.client_id) ?? "—"}
                  </Link>
                </TD>
                <TD>
                  <StatusPill tone={tone[p.status]} label={statusLabel[p.status]} />
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
    </>
  );
}
