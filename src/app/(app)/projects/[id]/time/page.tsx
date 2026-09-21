import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDuration, hoursPerDayFrom } from "@/lib/duration";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { ProjectHeader } from "../project-header";

export default async function ProjectTimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("week");
  const ti = await getTranslations("invoices");
  const tt = await getTranslations("tasks");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: entries }, { data: tasks }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*")
      .eq("project_id", id)
      .order("entry_date", { ascending: false }),
    supabase.from("tasks").select("id, title").eq("project_id", id),
  ]);

  const taskTitle = new Map((tasks ?? []).map((x) => [x.id, x.title]));
  const hoursPerDay = hoursPerDayFrom(profile.hours_per_day);
  const rows = entries ?? [];
  const total = rows.reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <>
      <ProjectHeader project={project} locale={profile.locale} />

      {rows.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <>
          <Table>
            <THead>
              <TH>{tt("date")}</TH>
              <TH>{t("duration")}</TH>
              <TH>{tt("title")}</TH>
              <TH>{t("note")}</TH>
              <TH align="end">{ti("status")}</TH>
            </THead>
            <TBody>
              {rows.map((entry) => (
                <TR key={entry.id}>
                  <TD className="text-ink-muted">{formatDate(entry.entry_date, profile.locale)}</TD>
                  <TD numeric>
                    {formatDuration(
                      entry.duration_minutes,
                      { hoursPerDay, allowDays: project.rate_type === "daily" },
                      profile.locale,
                    )}
                  </TD>
                  <TD className="text-ink-muted">
                    {entry.task_id ? (taskTitle.get(entry.task_id) ?? "—") : "—"}
                  </TD>
                  <TD className="text-ink-muted">{entry.description ?? "—"}</TD>
                  <TD align="end">
                    {entry.invoice_id ? (
                      <StatusPill tone="issued" label={ti("statusIssued")} />
                    ) : (
                      <span className="text-meta text-ink-muted">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <p className="mt-4 text-body text-ink-muted">
            {t("total")}:{" "}
            <span className="tabular font-medium text-ink">
              {formatDuration(total, { hoursPerDay, allowDays: false }, profile.locale)}
            </span>
          </p>
        </>
      )}
    </>
  );
}
