import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/ui/page";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { ChangeStatus } from "../change-status";
import { StatusHistory } from "../status-history";
import { ProjectHeader } from "./project-header";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("projects");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const { data: history } = await supabase
    .from("project_status_history")
    .select("*")
    .eq("project_id", id);

  return (
    <>
      <ProjectHeader project={project} locale={profile.locale} />

      <dl className="mb-8 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-meta text-ink-muted">{t("startDate")}</dt>
          <dd className="mt-1 text-body text-ink">
            {formatDate(project.start_date, profile.locale)}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">{t("endDate")}</dt>
          <dd className="mt-1 text-body text-ink">
            {formatDate(project.end_date, profile.locale)}
          </dd>
        </div>
        {project.description ? (
          <div className="sm:col-span-3">
            <dt className="text-meta text-ink-muted">{t("description")}</dt>
            <dd className="mt-1 max-w-[68ch] whitespace-pre-line text-body text-ink">
              {project.description}
            </dd>
          </div>
        ) : null}
      </dl>

      <Section title={t("changeStatus")} className="mb-8">
        <ChangeStatus id={project.id} status={project.status} />
      </Section>

      <Section title={t("history")}>
        <StatusHistory rows={history ?? []} locale={profile.locale} />
      </Section>
    </>
  );
}
