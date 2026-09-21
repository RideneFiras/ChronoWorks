import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { PeriodFilter } from "@/components/ui/period-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDuration, hoursPerDayFrom } from "@/lib/duration";
import { formatDate } from "@/lib/format";
import { formatColumn } from "@/lib/money";
import { periodRange, readPeriod } from "@/lib/period";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus, RateType } from "@/lib/database.types";

const tone = { active: "active", paused: "paused", done: "done" } as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const t = await getTranslations("projects");
  const tc = await getTranslations("clients");
  const tp = await getTranslations("period");
  const { profile } = await requireSession();

  const period = readPeriod((await searchParams).period);
  const { from, to } = periodRange(period);

  const supabase = await createClient();

  // Only the entries inside the period are fetched, so the total below is the
  // period's total and not a slice of everything.
  let entryQuery = supabase.from("time_entries").select("project_id, duration_minutes");
  if (from && to) entryQuery = entryQuery.gte("entry_date", from).lte("entry_date", to);

  const [{ data: projects }, { data: clients }, { data: entries }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client_id, status, rate_type, rate_amount, currency, start_date")
      .order("status")
      .order("name"),
    supabase.from("clients").select("id, name"),
    entryQuery,
  ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const minutesByProject = new Map<string, number>();
  for (const entry of entries ?? []) {
    minutesByProject.set(
      entry.project_id,
      (minutesByProject.get(entry.project_id) ?? 0) + entry.duration_minutes,
    );
  }

  const rows = projects ?? [];
  const hasClients = (clients ?? []).length > 0;
  const hoursPerDay = hoursPerDayFrom(profile.hours_per_day);
  const periodTotal = [...minutesByProject.values()].reduce((a, b) => a + b, 0);

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

      <div className="mb-4">
        <PeriodFilter active={period} basePath="/projects" />
      </div>

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
        <>
          <Table>
            <THead>
              <TH>{t("name")}</TH>
              <TH>{t("client")}</TH>
              <TH>{t("status")}</TH>
              <TH>{t("startDate")}</TH>
              <TH align="end">{tp("hours")}</TH>
              <TH align="end">{t("rateType")}</TH>
            </THead>
            <TBody>
              {rows.map((p) => {
                const minutes = minutesByProject.get(p.id) ?? 0;
                return (
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
                    <TD numeric className={minutes === 0 ? "text-ink-muted" : undefined}>
                      {minutes === 0
                        ? "—"
                        : formatDuration(
                            minutes,
                            { hoursPerDay, allowDays: p.rate_type === "daily" },
                            profile.locale,
                          )}
                    </TD>
                    <TD numeric>
                      {formatColumn(p.rate_amount, p.currency, profile.locale)}{" "}
                      <span className="font-normal text-ink-muted">{rateLabel[p.rate_type]}</span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <p className="mt-4 text-body text-ink-muted">
            {tp(period)}:{" "}
            <span className="tabular font-medium text-ink">
              {periodTotal === 0
                ? tp("noneInPeriod")
                : formatDuration(periodTotal, { hoursPerDay, allowDays: false }, profile.locale)}
            </span>
          </p>
        </>
      )}
    </>
  );
}
