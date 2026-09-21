import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatMoney } from "@/lib/money";
import { hoursPerDayFrom } from "@/lib/duration";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { thisWeekAnchor, todayColumn, weekDates } from "@/lib/week";
import type { Currency, TimeEntryRow } from "@/lib/database.types";
import { WeekGrid, type GridRow } from "./week-grid";
import { WeekNav } from "./week-nav";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const t = await getTranslations("week");
  const tc = await getTranslations("clients");
  const { profile } = await requireSession();
  const { w } = await searchParams;

  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(w ?? "") ? w! : thisWeekAnchor();
  const days = weekDates(anchor);
  const from = days[0];
  const to = days[days.length - 1];

  const supabase = await createClient();
  const [{ data: projects }, { data: entries }, { data: leaves }, { data: clients }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, client_id, status, rate_type, rate_amount, currency")
        .order("name"),
      supabase
        .from("time_entries")
        .select("*")
        .gte("entry_date", from)
        .lte("entry_date", to),
      supabase
        .from("leaves")
        .select("type, start_date, end_date")
        .lte("start_date", to)
        .gte("end_date", from),
      supabase.from("clients").select("id, name"),
    ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  // entries grouped by project and day
  const byProject = new Map<string, Record<string, TimeEntryRow[]>>();
  for (const entry of entries ?? []) {
    const cells = byProject.get(entry.project_id) ?? {};
    cells[entry.entry_date] = [...(cells[entry.entry_date] ?? []), entry];
    byProject.set(entry.project_id, cells);
  }

  // Active projects, plus any project with entries this week (PRD section 5).
  const rows: GridRow[] = (projects ?? [])
    .filter((p) => p.status === "active" || byProject.has(p.id))
    .map((p) => ({
      projectId: p.id,
      projectName: p.name,
      clientName: clientName.get(p.client_id) ?? "—",
      status: p.status,
      rateType: p.rate_type,
      cells: byProject.get(p.id) ?? {},
    }));

  // A day is on leave if any leave range covers it.
  const leaveLabels = await getTranslations("leave");
  const leaveDays: Record<string, string> = {};
  for (const leave of leaves ?? []) {
    for (const day of days) {
      if (day >= leave.start_date && day <= leave.end_date) {
        leaveDays[day] = leaveLabels(`type_${leave.type}`);
      }
    }
  }

  // "Unbilled this week: 1,240 EUR across 2 clients" (DESIGN.md section 6).
  // Grouped by currency, because a freelancer bills in more than one.
  const hoursPerDay = hoursPerDayFrom(profile.hours_per_day);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));
  const unbilledByCurrency = new Map<Currency, bigint>();
  const unbilledClients = new Set<string>();

  for (const entry of entries ?? []) {
    if (entry.invoice_id || !entry.is_billable) continue;
    const project = projectById.get(entry.project_id);
    if (!project || project.rate_type === "fixed") continue;

    const units =
      project.rate_type === "daily"
        ? entry.duration_minutes / (hoursPerDay * 60)
        : entry.duration_minutes / 60;

    // rate_amount is numeric(12,3); keep the maths in scaled integers
    const rateMilli = BigInt(Math.round(Number(project.rate_amount) * 1000));
    const amount = (rateMilli * BigInt(Math.round(units * 1000))) / 1000n;

    unbilledByCurrency.set(
      project.currency,
      (unbilledByCurrency.get(project.currency) ?? 0n) + amount,
    );
    unbilledClients.add(project.client_id);
  }

  const unbilledText = [...unbilledByCurrency.entries()]
    .filter(([, amount]) => amount > 0n)
    .map(([currency, amount]) => formatMoney(amount, currency, profile.locale))
    .join(" · ");

  return (
    <>
      <PageHeader title={t("title")} action={<WeekNav anchor={anchor} days={days} />} />

      {rows.length === 0 ? (
        <EmptyState
          message={t("empty")}
          action={
            <ButtonLink href="/projects/new" variant="primary">
              {tc("new")}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <WeekGrid
            rows={rows}
            days={days}
            today={todayColumn()}
            leaveDays={leaveDays}
            hoursPerDay={hoursPerDay}
            locale={profile.locale}
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <p className="text-body text-ink-muted">
              {unbilledText
                ? t("unbilled", { amount: unbilledText, clients: unbilledClients.size })
                : t("unbilledNone")}
            </p>
            {unbilledText ? (
              <ButtonLink href="/invoices/new" variant="primary">
                {t("createInvoice")}
              </ButtonLink>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
